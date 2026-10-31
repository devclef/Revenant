# Implementation Plan: 02 Demo figures

Each task is one GitHub issue, worked by one agent, and leaves `main` passing the CI gate. Validation always includes the CI gate; commands below are what the agent must run locally first. Both tasks need `src/lib/seal-format` on `main` exports `figureV1Schema`, `metricDefinitionV1Schema`, `FigureV1` and `MetricDefinitionV1` (spec 02-sealed-letters task 1, issue 28, or its follow-up). `zod` and `fast-check` come with that work. The owner keeps this file off `main` until then.

- [x] 1. Figures model: periods, fixture predicates, catalogue and loader
  - Agent: `data-dev` · Depends on: none
  - Before this task: `src/lib/seal-format` on `main` exports `figureV1Schema`, `metricDefinitionV1Schema`, `FigureV1` and `MetricDefinitionV1` (spec 02-sealed-letters task 1, issue 28, or its follow-up).
  - Scope: `src/lib/figures/types.ts`, `periods.ts`, `fixture.ts`, `catalogue.ts`, `load.ts`, `index.ts` and their `*.test.ts`
  - Acceptance:
    - Types per design.md: `CatalogueSeries`, `FigureFile`, `LoadedSeries`, `LoadedFigures`, `ThenNow`. Figures and metrics use `FigureV1` and `MetricDefinitionV1` and are validated with `figureV1Schema` and `metricDefinitionV1Schema` imported from `src/lib/seal-format`. No second schema for those fields.
    - `periods.ts`: `isRealDate`, `isRealMonth` and `periodEnd` (weekly is the date itself; monthly is the last day of the month, leap years included). Comparison is by `YYYY-MM-DD` string.
    - `fixture.ts`: `FIXTURE_PREFIX`, `isFixtureFigure` and `isFixtureMetric`. Each is true when `source` or `series_id` starts with `FIXTURE`, case-sensitive.
    - `catalogue.ts`: exactly the four entries in the design.md catalogue table (US gasoline `EMM_EPMR_PTE_NUS_DPG`, US diesel `EMD_EPD2D_PTE_NUS_DPG`, EU Euro-super 95 and EU diesel as Oil Bulletin file/sheet/column descriptions), in that order, with units as published, `period_type: "weekly"`, and the ÷1000 → EUR per litre display rescale on the EU entries only. `source_url` per design.md. No Sweden entries.
    - `load.ts`: `loadFigureFile(json, catalogue)` checks the rules in the design.md order and throws `FigureDataError { rule, path }` with a fixed message. Its output groups figures by series, sorts them by period end, keeps value strings unchanged and is deep-frozen.
    - Example tests:
      - Catalogue metrics pass `metricDefinitionV1Schema` and are not fixture.
      - Catalogue ID order is fixed.
      - Display names contain no change words.
      - One rejection example each for R1.4, R3.3, R3.5 and both R5.4 cases.
    - Properties 3, 4 and 10 as fast-check tests, `numRuns: 100`, tagged `// Feature: 02-demo-figures, Property N: <title>`.
    - Pure modules: nothing imported from `src/lib/crypto`, `src/lib/db` or Node built-ins. No network in tests. No new dependencies.
  - Validation: `bash scripts/check.sh` (`npm ci && npm run lint && npm run typecheck && npm test && npm run build`)
  - _Requirements: R1.1–R1.4, R2.1–R2.8, R3.1–R3.5, R5.1, R5.4, R5.6, R7.1, R7.3, R7.4, R7.7_

- [ ] 2. US fuel fixture and the then/now helper
  - Agent: `data-dev` · Depends on: 1
  - Before this task: `src/lib/seal-format` on `main` exports `figureV1Schema`, `metricDefinitionV1Schema`, `FigureV1` and `MetricDefinitionV1` (spec 02-sealed-letters task 1, issue 28, or its follow-up).
  - Scope: `src/lib/figures/demo/us-fuel.fixture.json`, `src/lib/figures/demo/index.ts`, `src/lib/figures/then-now.ts`, `src/lib/figures/index.ts` (add exports) and their `*.test.ts`
  - Acceptance:
    - The fixture JSON is exactly the design.md fixture:
      - Top-level `"fixture": true` and the `note`.
      - Two series, `fixture-us-gasoline-regular` and `fixture-us-diesel`. Display names are the catalogue names plus ` (fixture)`, with `FIXTURE` `source` and `series_id`, and the same unit and region as the catalogue.
      - Ten weekly figures for periods 2023-11-06, 2024-05-06, 2024-11-04, 2025-11-03 and 2026-10-26. Gasoline is `1.00`, `2.00`, `3.00`, `4.00`, `5.00`; diesel is `10.00`, `9.00`, `8.00`, `7.00`, `6.00`.
      - Every figure has `kind: "official"`, `retrieved_at: "2000-01-01T00:00:00Z"` and `source_url` set to the real EIA series page. No EU figures.
    - `demo/index.ts` exports `DEMO_FIGURES = loadFigureFile(fixture, CATALOGUE)`, the one import spec 03 uses. `src/lib/figures/real/` is not created.
    - `thenAndNow(metricId, date, data)` per design.md:
      - A date that isn't a real `YYYY-MM-DD` throws `RangeError`.
      - Gaps return `unknown_series`, `no_figures` or `none_at_or_before_date`; the last still returns "now".
      - Returned figures are the loaded references, unchanged. No interpolation, averaging or substitution.
    - Example tests:
      - Each fixture figure passes `figureV1Schema` and each fixture metric `metricDefinitionV1Schema`.
      - The R4.1–R4.7 rules hold.
      - Every fixture entry is detected by `isFixtureFigure` / `isFixtureMetric`.
      - `thenAndNow` on `DEMO_FIGURES` for `2024-11-05` gives then 3.00 / 8.00 and now 5.00 / 6.00.
      - For `2023-10-01` "then" is `none_at_or_before_date`.
      - Catalogue series return `no_figures`.
    - Properties 1, 2 and 5–9 as fast-check tests, `numRuns: 100`. Property 2 checks a fixture figure sealed into a payload, serialised with `canonicalize` and parsed back with `payloadV1Schema`, is still detected by `isFixtureFigure`.
  - Validation: `bash scripts/check.sh` (`npm ci && npm run lint && npm run typecheck && npm test && npm run build`)
  - _Requirements: R1.5, R4.1–R4.8, R5.1–R5.5, R6.1–R6.9, R7.1, R7.2, R7.5, R7.6_

## Task Dependency Graph

Dependencies: 1 → 2. Both tasks also need `src/lib/seal-format` on `main` exports `figureV1Schema`, `metricDefinitionV1Schema`, `FigureV1` and `MetricDefinitionV1` (spec 02-sealed-letters task 1, issue 28, or its follow-up). That cross-spec dependency is held by the owner, not by `Depends on`.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] }
  ]
}
```
