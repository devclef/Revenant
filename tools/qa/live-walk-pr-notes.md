# Live_Walk on merged main (issue #399): PR notes

## Verdict

**Task 18: FAIL under Q1.6.** No Live_Walk has run on merged `main`. No step is claimed as passed. The record is in `tools/qa/live-walk-run-record.md`.

## Notes from the agent

- The required matrix in the run record lists all eight rows (1440x900 and 390x844, each with no figure and one figure, motion on and reduced motion). Every row is NOT RUN. The no-figure reduced-motion rows are not in `WALK_MATRIX`, so the record says so and does not count them as walked.
- The run record states that the 36-run result (6 passed, 30 failed, walk stopped before unlock) comes from the task brief. The committed files do not hold its per-run output, so those counts are not verified.
- The walk script code the walk depends on is in `d245f47`, `466c72c`, `55cdd6b` and `0c3f0f1`. None of these is on `origin/main` yet.
- Clipped-text exemption: `checkClippedText` in `src/test/integration/live-walk-helpers.ts` skips a container only when its class matches `visuallyHidden` or `stepper` and its `clientWidth` is 1px or less. This relaxes the Q1.6 check "text clipped by its container" for those hidden-by-design elements. The owner must confirm this exemption before the final walk. Any other clipped container still fails.
- Production_Check: the command is copied exactly in the section below. J2 and J9 are not yet run against production. Real_Device_Check is not run and does not affect the verdict.

## Run record summary

Quoted from `tools/qa/live-walk-run-record.md`.

Required matrix (each row is one Live_Walk run on merged `main`; none has run):

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

Earlier 36-run brief (reported, not verified): 36 runs attempted, 6 passed, 30 failed, walk stopped before unlock. The committed files do not contain the per-run output.

## Production_Check

Copied from the run record section of the same name.

- Production URL: `https://revenant.devclef.se`
- Command: `node tools/qa/journey-check.mjs --url https://revenant.devclef.se --chromium /usr/bin/chromium --require J1,J2,J3,J4,J5,J6,J7,J8 --no-issue`
- Exit code 0. Run time `2026-11-14T01:59:00.011Z`. Summary: `Checks: 128. Failed: 0. Notes: 4.`
- Verdict: PASS for every check that ran (J1, J3, J4, J5, J6, J7, J8).
- Required and not run against production: **J9 and J2**. J2 needs `--reveal` or the 00:47 UTC run (OD8). J9 was not in `--require`.
- Rerun command, with J9 required and J2 forced by `--reveal` (OD8):
  `node tools/qa/journey-check.mjs --url https://revenant.devclef.se --chromium /usr/bin/chromium --require J1,J2,J3,J4,J5,J6,J7,J8,J9 --reveal --no-issue`
- Result of that rerun: not yet recorded.
- J2 and J9: not yet run against production. Neither is in the 2026-11-14 run.
- Real_Device_Check: not run. It does not affect the verdict.

## Defects for frontend-dev

Reported, not verified on merged `main`. Full table in the run record.

- D1: J9 on `/demo/live` at 1440x900 fails (reported in the brief; observed detail not saved). Suspect: `src/components/live/` or `tools/qa/journey-check.mjs`.
- D2: J9 on `/demo/live` at 390x844 fails (same). Same suspects.
- D3 to D8: unlock, testify, marks, letter, figures and close steps on `/demo/live`. Not reached in the reported run, so unverified.

## OUT OF SCOPE (owner steps)

- Merge the prerequisite commits `d245f47`, `466c72c`, `55cdd6b` and `0c3f0f1` to `main` through a reviewed pull request. This is an owner decision.
- Then run `npm run live-walk` from a checkout of the new `main` at 1440x900 and 390x844, covering the full matrix.

## Verdict

FAIL under Q1.6. No walk has run on merged `main`.
