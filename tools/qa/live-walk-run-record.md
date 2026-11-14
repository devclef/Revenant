# Live_Walk run record (issue #399)

**Status: NOT RUN.** The walk was not executed because the precondition for a merged-main run failed. This record replaces the earlier record in commit `db5e038`. None of that commit's content is used here.

## Code under test

- `origin/main`: `d6e013d` ("Tick completed spec tasks [skip ci]"), fetched 2026-11-14.
- Branch `kirocrew/task/TASK_f453c78a_1794617838611514918` before this record: `db5e038`.
- The worktree is not at `origin/main` and cannot be fast-forwarded to it. `origin/main` is an ancestor of the branch. The branch has five commits that `origin/main` does not have:
  - `55cdd6b` [platform-dev] Live_Walk: a step with no Step_Shot fails
  - `0c3f0f1` [platform-dev] Live_Walk: every expected Step_Shot must be named in the run record
  - `d245f47` [platform-dev] Live_Walk: visually hidden 1px containers are not clipped text
  - `466c72c` [platform-dev] Live_Walk: read the receipts disclosure and press Next before the seal
  - `db5e038` Q1.7 Final Live_Walk run record (issue #399)
- Setup PRs: #407 (`d3dc80f`, Q1 and Q2 Live_Walk setup) and #420 (`bbc7e2b`, D1 README) are on `origin/main`.

## Why the walk did not run

The task's step 6 says to stop and record when the worktree is not a fast-forward of `origin/main`. Running on `origin/main` as it stands would test the walk script without the two script fixes (`d245f47`, `466c72c`) and without the missing-shot wiring (`55cdd6b`, `0c3f0f1`). Its output would not describe the current walk script. Running on the branch would not be a run on merged main.

## Results

- Walk runs completed: 0 of 8. The eight runs are 1440x900 and 390x844, each with no figure or one figure, each with motion on and reduced motion.
- Result lines printed by the script: none.
- Per-step results: not produced. Every step is not passed, because no step ran.
- Step_Shots: none saved. All expected shots are missing: `live-01-write` through `live-10-close`, in all eight runs. The full-page captures for letter, figures and close are missing too.
- Single_Figure_View check and 0-figure close: not run.
- Q1.6 verdict: not determined. No walk ran, so no Q1.6 condition was checked.
- Defects: none recorded. The walk did not run, so it found nothing. This is not a pass.
- Cut steps: not evaluated, because no walk ran.
- Production_Check: not run. It depends on tasks 6 and 7.

## To unblock

1. Land the five branch commits on `main` through a reviewed pull request. This is an owner decision.
2. Rerun this task from a worktree at the new `origin/main` that includes those commits, then replace this record.

## Production_Check (Journey_Check against production)

- Production URL: `https://revenant.devclef.se`
- Command (the scheduled workflow's arguments, with local output only):
  `node tools/qa/journey-check.mjs --url https://revenant.devclef.se --chromium /usr/bin/chromium --require J1,J2,J3,J4,J5,J6,J7,J8 --no-issue`
- Exit code: 0. The script printed the run time `2026-11-14T01:59:00.011Z`.
- `--no-issue` was used, so GitHub was not touched and no Journey_Issue was opened or commented on.
- No `--reveal` flag, so J2 (persona reveal) did not run. J2 runs on the 00:47 UTC schedule and on manual runs only (OD8), because each walk stores an encrypted "no answer" Recall_Record. J9 is not in the workflow's `--require` list, so it did not run either.
- Verdict: **PASS** for every check that ran (J1, J3, J4, J5, J6, J7, J8). J2 did not run in this invocation.
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
