# Spec 12 open task lines: evidence (issue #440)

Checked on 2026-11-17 against `origin/main` at `d076f35`. The worktree HEAD (`7a274ae`) differs from main only by `.kiro/specs/13-the-seal/tasks.md`, so every `src/` file read here is identical on both.

Rule applied: a line is ticked only when its artefact is on main. For an implementation line, that is the file its task names, and the file must contain the named export. For a property line, that is a test file carrying `// Feature: 12-submission-polish, Property N: <title>` that passes `npx vitest run <file>`.

## Ticked (10 lines)

| Line | Artefact on main | Merged PR |
|---|---|---|
| 2.1 | `src/lib/figures/same-figure.ts` (`isSameFigure`) | #403 |
| 4.1 | `src/components/live/stepper/live-steps.ts` (`LIVE_STEPS`, `stepForStage`, `STAGE` in `reduceStepper`, dispatched from `src/components/live/SealPage.tsx`) | #405 |
| 5.1 | `src/components/reveal/receipt-kind.ts` (`receiptKindFor`) | #406 |
| 5.3 | `src/components/reveal/ReceiptCard.single.property.test.tsx` (Property 5, `numRuns: 100`, 5 tests pass) | #406 |
| 8.1 | `src/components/live/author-questions.ts` (`focusAfterRemove`) | #409 |
| 9.1 | `src/components/live/ReceiptsDisclosure.tsx` (`openRequest`), `src/components/live/form.ts` (`isEmptySelfReportedRow`) | #411 |
| 10.1 | `src/components/reveal/display-figure.ts` (`displayFigureValue`) | #413 |
| 10.2 | `src/components/ui/letter-date.ts` (`formatShortDate`) | #413 |
| 10.3 | `src/components/live/FigurePicker.tsx` (`pickerNote`) | #413 |
| 11.1 | `src/components/live/catalogue-list.ts` (`regionGroupFor`, `groupPickable`) | #416 |

## Open (10 lines)

Each open property line has no tagged test file on main. The only tag on main is Property 5. The tag search was `git grep -n "Feature: 12-submission-polish" origin/main -- src`, which returned one hit.

| Line | Missing artefact |
|---|---|
| 2.2 | Test file tagged Property 3: Same_Figure is exact, symmetric and reflexive |
| 4.2 | Test file tagged Property 1: The indicator has exactly one current item |
| 4.3 | Test file tagged Property 2: Reported Stages never move the step back |
| 5.2 | Test file tagged Property 4: A figure gets the Single_Figure_View if and only if it is a Same_Figure |
| 8.2 | Test file tagged Property 7: Removing a question leaves focus on the nearest remaining row, or on Add |
| 9.2 | Test file tagged Property 6: A blank own-number row changes nothing, and a partly filled one blocks |
| 10.4 | Test file tagged Property 8: The picker shows the Receipt_Card's number and changes no stored value |
| 10.5 | Test file tagged Property 9: A Short_Date does not depend on the viewer's timezone |
| 10.6 | Test file tagged Property 10: The Picker_Note appears once, or not at all |
| 11.2 | Test file tagged Property 11: Every pickable figure is in exactly one region group, in a fixed order |

## Commands run

- `git fetch origin main`
- `git show origin/main:.kiro/specs/12-submission-polish/tasks.md | grep -n '^\s*- \[ \]'`: 20 open sub-task lines, matching the ticket list.
- `git grep -n "Feature: 12-submission-polish" origin/main -- src`: one hit, Property 5.
- `git log origin/main --oneline -- <path>` for each artefact above, for the PR numbers.
- `git grep -n "export function <name>" origin/main -- src` for each named export.
- `npx vitest run src/components/reveal/ReceiptCard.single.property.test.tsx`: 1 file, 5 tests passed, exit 0.

## Scope of the check

The implementation test checks that the named file exists on main and exports the named function. It does not check each acceptance bullet of the sub-task. The ticket sets this rule.

## Path

The ticket names `/home/dopey/kiro/revenant-crew/dev/tools/qa/patches/`. That path is outside the task worktree and does not exist. This file is written to the worktree copy at `tools/qa/patches/spec-12-tasks.evidence.md`, which platform-dev owns under `tools/qa/**`.
