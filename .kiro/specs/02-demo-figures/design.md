# Design: 02 Demo figures

Follows `data-integrity.md`, `neutrality.md` and `tech.md`; this file records decisions specific to this spec.

## Overview

This spec adds a small, pure figures module under `src/lib/figures`: a catalogue of four real fuel series (US and EU petrol and diesel), one clearly fake fixture file for the US persona, a loader that validates figure files, `isFixtureFigure` / `isFixtureMetric`, and a then/now helper. There is no network, database, route or UI. Everything is data-dev's and stays inside `src/lib/figures/**`.

**Blocked on spec 02-sealed-letters task 1 (issue 28).** This module imports `figureV1Schema`, `metricDefinitionV1Schema`, `payloadV1Schema`, `canonicalize` and the types `FigureV1` and `MetricDefinitionV1` from `src/lib/seal-format`, and uses the `zod` and `fast-check` dependencies that task adds. No task in this spec can start until issue 28 is merged. The owner holds this spec's `tasks.md` off `main` until then.

**Sweden fuel is deferred** to the real-data spec. That spec must first check SCB and Energimyndigheten for an official SEK source, and otherwise decide between EUR prices from the Weekly Oil Bulletin and no Sweden fuel. The Oil Bulletin no longer publishes Sweden in SEK, and converting from EUR is not allowed. Details are under "Sweden" in Data Models.

## Architecture

```
src/lib/figures/
├── index.ts                    # public API (re-exports below)
├── types.ts                    # CatalogueSeries, FigureFile, LoadedFigures, ThenNow
├── periods.ts                  # period formats, period end, real-date checks
├── fixture.ts                  # FIXTURE_PREFIX, isFixtureFigure, isFixtureMetric
├── catalogue.ts                # the four real series (metric definitions, no figures)
├── load.ts                     # loadFigureFile(json, catalogue): validated, frozen LoadedFigures
├── then-now.ts                 # thenAndNow(metricId, date, data)
├── demo/
│   ├── us-fuel.fixture.json    # the fixture: "fixture": true, US petrol and diesel
│   └── index.ts                # DEMO_FIGURES = loadFigureFile(fixture, CATALOGUE); spec 03 imports this
├── real/                       # reserved, NOT created by this spec
│   └── fuel-figures.json       # later spec: real data, "fixture": false
└── *.test.ts                   # unit, example and fast-check tests
```

- `catalogue.ts` is TypeScript, so the four definitions are type-checked against `MetricDefinitionV1` at compile time and validated again with `metricDefinitionV1Schema` in a test.
- Figure files (fixture now, real data later) are JSON with one shape, read by one loader.
- **Swapping to real data:** a later spec adds `real/fuel-figures.json` and changes the single import in `demo/index.ts`. The fixture file is never edited into real data (R4.8). It can be deleted or kept for tests.
- All modules are pure and import nothing from `src/lib/crypto`, `src/lib/db` or Node built-ins, so spec 03 can use them in the browser and on the server. JSON import works with the existing `resolveJsonModule: true`.

## Components and Interfaces

### Types (`types.ts`)

```ts
import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";

type PeriodType = "weekly" | "monthly";

interface DisplayRescale {
  divisor: 10 | 100 | 1000 | 10000 | 100000 | 1000000; // exact power of ten (R2.5)
  unit: string;                                         // unit after rescale, e.g. "EUR per litre"
}

// Catalogue-only fields sit next to the metric, never inside it (R2.4, R2.6).
interface CatalogueSeries {
  metric: MetricDefinitionV1;
  period_type: PeriodType;
  display_rescale?: DisplayRescale;
}

// JSON shape of a figure file.
interface FigureFile {
  fixture: boolean;
  note?: string;                 // plain description of the file, 1–500 chars
  series: CatalogueSeries[];     // series defined by this file (fixture defines its own two)
  figures: FigureV1[];           // may reference series in this file or in the catalogue
}

interface LoadedSeries {
  readonly metric: Readonly<MetricDefinitionV1>;
  readonly period_type: PeriodType;
  readonly display_rescale?: Readonly<DisplayRescale>;
  readonly figures: readonly Readonly<FigureV1>[]; // sorted by period end, oldest first
}

interface LoadedFigures {
  readonly fixture: boolean;
  readonly series: ReadonlyMap<string, LoadedSeries>; // key: metric id; catalogue order first, then file order
}

type Missing = { found: false; reason: "unknown_series" | "no_figures" | "none_at_or_before_date" };
type Found = { found: true; figure: Readonly<FigureV1> };
interface ThenNow { then: Found | Missing; now: Found | Missing }
```

### Periods (`periods.ts`)

- `isRealDate("YYYY-MM-DD")`: matches `^\d{4}-\d{2}-\d{2}$` and round-trips through `Date.UTC` (rejects `2024-02-30`).
- `isRealMonth("YYYY-MM")`: matches `^\d{4}-\d{2}$` with month 01–12.
- `periodEnd(period, type)`: returns a `YYYY-MM-DD` string. Weekly: the date itself. Monthly: the last day of the month, leap years included (R3.4).
- Comparison is plain string comparison of `YYYY-MM-DD`, which is date order. No `Date` objects or time zones cross the API.

### Fixture predicates (`fixture.ts`)

```ts
export const FIXTURE_PREFIX = "FIXTURE";
export function isFixtureFigure(f: Pick<FigureV1, "source" | "series_id">): boolean;
export function isFixtureMetric(m: Pick<MetricDefinitionV1, "source" | "series_id">): boolean;
// both: source.startsWith("FIXTURE") || series_id.startsWith("FIXTURE")
```

They read only sealed fields, so they work on decrypted payload figures in spec 03 (R5.1, R5.2). Matching is case-sensitive: `FIXTURE` exactly.

### Loader (`load.ts`)

`loadFigureFile(json: unknown, catalogue: readonly CatalogueSeries[]): LoadedFigures`. It throws `FigureDataError` on the first failed rule. Checks run in this order:

1. **File shape:** a strict Zod object `{ fixture: boolean, note?: string, series: [...], figures: [...] }`. The series' `metric` uses `metricDefinitionV1Schema`, the figures use `figureV1Schema`, and `period_type` and `display_rescale` are checked as in the types above (R1.1, R1.2, R2.4, R2.5).
2. **Catalogue validity:** every catalogue entry passes the same series check.
3. **Unique metric IDs** across the catalogue and the file together (R2.3).
4. **Fixture flag agreement** (R5.4):
   - With `fixture: true`, every series metric and figure in the file has both `source` and `series_id` starting with `FIXTURE`.
   - With `fixture: false`, no series metric or figure in the file matches `isFixtureFigure` / `isFixtureMetric`.
   - The catalogue itself must contain no fixture metric.
5. **Figures reference a known series:** each `metric_id` resolves to exactly one series in the file or the catalogue.
6. **Figure matches its metric** (R1.4): `unit`, `region`, `source` and `series_id` equal the metric's. `kind` is `official` (R1.3).
7. **Period format** matches the series' `period_type` and names a real date or month (R3.1–R3.3).
8. **No duplicate period** within a series (R3.5).

On success it groups figures by series and sorts each group by period end (so file order never matters). It then deep-freezes everything and returns it. Values are kept as the exact strings from the file, and rescale is never applied (R2.5). Series with no figures (all four catalogue series when the fixture is loaded) are present with an empty `figures` array.

`FigureDataError` has `rule: "shape" | "duplicate_metric_id" | "fixture_flag" | "unknown_metric" | "metric_mismatch" | "bad_period" | "duplicate_period"` and `path` (for example `figures.3.period`). Its message is fixed text naming the rule and path.

### Then and now (`then-now.ts`)

`thenAndNow(metricId: string, date: string, data: LoadedFigures): ThenNow`

1. If `isRealDate(date)` fails, throw `RangeError("date must be a real calendar date in the form YYYY-MM-DD")` (R6.8).
2. No series with that ID: both results are `unknown_series` (R6.5).
3. Series with no figures: both results are `no_figures` (R6.6).
4. `now` is the last element of the sorted figures (R6.3). `then` is the last element whose period end is `<= date`, or `none_at_or_before_date` (R6.2, R6.7).
5. Returned figures are the frozen references held in `data`. Nothing is copied, rounded, rescaled or added (R6.4), and nothing is computed from two figures (R6.9).

The "then" date in spec 03 is the persona's window date, for example `2024-11-05`. Applying the display rescale and computing the change are spec 03 and `lib/figures` derived-value work, not part of this spec.

## Data Models

### Catalogue: the four real series

All entries were checked on **2026-10-31**. Every entry has `period_type: "weekly"`. Both publishers date each week by a Monday (for example EIA's `10/07` in `2024-Oct`, and the Oil Bulletin's 2024-11-04 row), and the period string is that date.

| `id` | `display_name` | `unit` (as published) | `region` | `source` | `series_id` | Display rescale | Status |
|---|---|---|---|---|---|---|---|
| `us-gasoline-regular` | Regular gasoline (all formulations), retail price | USD per gallon | U.S. | U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices | `EMM_EPMR_PTE_NUS_DPG` | none | Confirmed |
| `us-diesel` | No. 2 diesel, retail price | USD per gallon | U.S. | U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices | `EMD_EPD2D_PTE_NUS_DPG` | none | Confirmed |
| `eu-petrol-euro95` | Euro-super 95 petrol, retail price including taxes | EUR per 1,000 litres | EU27, weighted average | European Commission, Weekly Oil Bulletin | `File Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx, sheet "Prices with taxes", column C "EU_price_with_tax_euro95", country EU27 weighted average (rows marked EU_)` | ÷ 1000 → EUR per litre | Confirmed |
| `eu-diesel` | Automotive diesel, retail price including taxes | EUR per 1,000 litres | EU27, weighted average | European Commission, Weekly Oil Bulletin | `File Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx, sheet "Prices with taxes", column D "EU_price_with_tax_diesel", country EU27 weighted average (rows marked EU_)` | ÷ 1000 → EUR per litre | Confirmed |

Where each was confirmed:

- **EIA gasoline:** the series' history page https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_NUS_DPG&f=W has the title "Weekly U.S. Regular All Formulations Retail Gasoline Prices (Dollars per Gallon)". The ID also appears on the table page https://www.eia.gov/dnav/pet/pet_pri_gnd_dcus_nus_w.htm.
- **EIA diesel:** https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMD_EPD2D_PTE_NUS_DPG&f=W has the title "Weekly U.S. No 2 Diesel Retail Prices (Dollars per Gallon)". It is listed on the same table page. EIA notes a methodology change on 13 June 2022, which is before the demo window.
- **Oil Bulletin EU27:** the "Price developments 2005 onwards (xlsx)" link on https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en downloads `Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx`.
  - Sheet "Prices with taxes": row 1 holds the column keys, row 2 the product names ("Euro-super 95 (I)", "Gas oil automobile / Automotive gas oil"), row 3 the unit "1000 l" and column A the date.
  - Columns C and D hold the EU_ figures. Columns J and K are the euro area (EUR_), which is not used.
  - I matched column C's latest value against the latest weekly file, "Prices with taxes latest prices (xlsx)", where it sits on the row "CE/EC/EG EUR27_2020 … Moyenne pondérée" (weighted average). The weekly file is headed "in EUR".
- The catalogue `source_url` for EIA entries is the series' history page. For Oil Bulletin entries it is the Weekly Oil Bulletin page above.

The Oil Bulletin `series_id` is a sentence naming the file, sheet, column and country, so nobody can take it for an official identifier (R2.2). It is under the 200-character limit. Column letters can shift, so the column header key is the part to match on. A later fetch spec must check the header and fail if it is not found.

### Sweden: deferred

No Sweden series in this spec. What was found on 2026-10-31, for the real-data spec:

- The history workbook's sheet "Prices with taxes" has Sweden in columns GO `SE_price_with_tax_euro95` and GP `SE_price_with_tax_diesel`, unit "1000 l". The values are EUR per 1,000 litres, not SEK; for example, petrol on 2024-11-04 is 1,463.01. Column GN `SE_exchange_rate` is about 0.086–0.090 EUR per SEK.
- The latest weekly file is headed "in EUR", and the bulletin page lists no national-currency file.
- Deriving SEK would mean dividing by the exchange rate, which is a currency conversion and is not allowed.

The real-data spec checks SCB and Energimyndigheten for an official SEK retail fuel price series first. If neither has one, it decides between EUR from the Oil Bulletin (columns GO and GP, with an exception to "Sweden in SEK" recorded in `product.md` and `tech.md`) and no Sweden fuel.

### Fixture (`demo/us-fuel.fixture.json`)

```jsonc
{
  "fixture": true,
  "note": "Fake figures for building the persona demo. Not real prices. Replaced by real data in a later spec.",
  "series": [
    { "metric": { "id": "fixture-us-gasoline-regular",
                  "display_name": "Regular gasoline (all formulations), retail price (fixture)",
                  "unit": "USD per gallon", "region": "U.S.",
                  "source": "FIXTURE U.S. EIA weekly retail gasoline (fake data)",
                  "series_id": "FIXTURE-EMM_EPMR_PTE_NUS_DPG" },
      "period_type": "weekly" },
    { "metric": { "id": "fixture-us-diesel",
                  "display_name": "No. 2 diesel, retail price (fixture)",
                  "unit": "USD per gallon", "region": "U.S.",
                  "source": "FIXTURE U.S. EIA weekly retail diesel (fake data)",
                  "series_id": "FIXTURE-EMD_EPD2D_PTE_NUS_DPG" },
      "period_type": "weekly" }
  ],
  "figures": [ /* rows below; every figure: kind "official", retrieved_at "2000-01-01T00:00:00Z",
                  unit/region/source/series_id copied from its metric, source_url = the real EIA series page */ ]
}
```

| `period` (Monday) | Where | Gasoline `value` | Diesel `value` |
|---|---|---|---|
| 2023-11-06 | window start | `1.00` | `10.00` |
| 2024-05-06 | inside window | `2.00` | `9.00` |
| 2024-11-04 | last week at or before election day 2024-11-05 | `3.00` | `8.00` |
| 2025-11-03 | after window | `4.00` | `7.00` |
| 2026-10-26 | after window, latest ("now") | `5.00` | `6.00` |

- That is 10 figures, all with `retrieved_at` `2000-01-01T00:00:00Z` (R4.5). Each value matches `^[0-9]+\.00$` (R4.4), and the values are clearly not real prices. Gasoline rises from 1.00 to 5.00 and diesel falls from 10.00 to 6.00, so spec 03 has one series moving each way. The two directions get the same treatment (`neutrality.md`); the fixture only exists so both can be built and checked.
- Each series has 3 figures in the window and 2 after it (R4.6). There are no EU figures (R4.7).
- `source_url` for gasoline is https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_NUS_DPG&f=W, and for diesel the same URL with `EMD_EPD2D_PTE_NUS_DPG` (R4.3).
- With date `2024-11-05`, `thenAndNow` returns 3.00 / 8.00 as "then" and 5.00 / 6.00 as "now". With date `2023-10-01`, "then" is `none_at_or_before_date`. Spec 03 can show both cases.
- The fixture metric IDs are separate from the catalogue IDs, so R2.3 holds. The fixture source strings say "fake data" in plain words, as well as having the prefix.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Each property is one fast-check test with `numRuns: 100`, tagged `// Feature: 02-demo-figures, Property N: <title>`. Generated figures use `FIXTURE` sources, round values and Monday or `YYYY-MM` periods (R7.6).

### Property 1: Fixture subsets seal and parse unchanged

For any non-empty subset of fixture figures, a payload holding those figures and the metric definitions they reference (plus a fixed letter text and no recall questions) passes `payloadV1Schema`. `payloadV1Schema.parse(JSON.parse(canonicalize(payload)))` gives figures deeply equal to the inputs, with every `value` string identical.

**Validates: Requirements 1.2, 1.5, 7.2**

### Property 2: Fixture detection survives sealing

For any fixture figure, after the Property 1 round trip, `isFixtureFigure` on the parsed figure is `true`, and `isFixtureMetric` on its parsed metric is `true`.

**Validates: Requirements 5.1, 5.2, 5.5**

### Property 3: Fixture predicates match their definition exactly

For any strings `source` and `series_id`, `isFixtureFigure({source, series_id})` and `isFixtureMetric({source, series_id})` both equal `source.startsWith("FIXTURE") || series_id.startsWith("FIXTURE")`. Generators include the `FIXTURE` prefix, lowercase `fixture`, a leading space and `FIXTURE` inside the string.

**Validates: Requirements 5.1**

### Property 4: Period end and date checks

For any year 1900–2100 and month, `periodEnd("YYYY-MM", "monthly")` is the real last day of that month, leap years included. For any real date, `periodEnd(d, "weekly") === d`. For any string that is not a real date or month in the required form (bad day, month 13, missing zero, extra characters), the loader rejects a figure using it with `bad_period`.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 5: "Then" is the latest figure at or before the date

For any generated series with unique periods and any real date, if `then` is found, its period end is `<= date` and no other figure in the series has a period end in `(then's period end, date]`. If no figure has a period end `<= date`, `then` is `none_at_or_before_date`.

**Validates: Requirements 6.2, 6.7, 6.9**

### Property 6: "Now" is the latest figure overall

For any generated non-empty series and any date, `now` is found, and its period end is the maximum period end in the series, whatever the date.

**Validates: Requirements 6.3**

### Property 7: Returned figures are the loaded objects

For any generated file, series and date, every figure `thenAndNow` returns is reference-equal (`===`) to an element of `data.series.get(metricId).figures`. It belongs to that metric ID, and its `value` string equals the string in the input JSON.

**Validates: Requirements 2.5, 6.4, 6.9**

### Property 8: File order never changes a result

For any generated file and any shuffle of its `figures` array, loading both and calling `thenAndNow` for every metric ID and any date gives `then` and `now` with the same period and value.

**Validates: Requirements 3.5, 7.6**

### Property 9: Gaps are reported, not filled

For any generated data, an unknown metric ID gives `unknown_series` for both results, and a series with no figures gives `no_figures` for both. A date before every period end gives `none_at_or_before_date` for `then` and still returns `now`. No call returns a figure in these cases.

**Validates: Requirements 6.5, 6.6, 6.7, 7.6**

### Property 10: The loader rejects every rule break

For any valid generated file and any single mutation from this set, `loadFigureFile` throws `FigureDataError` with the matching `rule`:

- a figure's `unit`, `region`, `source` or `series_id` changed from its metric's (`metric_mismatch`);
- a bad period (`bad_period`);
- two figures in one series sharing a period (`duplicate_period`);
- a `metric_id` that matches no series (`unknown_metric`);
- a duplicated metric ID (`duplicate_metric_id`);
- `fixture: true` with one entry missing the prefix on `source` or `series_id`, or `fixture: false` with one prefixed entry (`fixture_flag`).

**Validates: Requirements 1.4, 2.3, 3.3, 3.5, 5.4, 7.3, 7.7**

## Error Handling

| Where | Condition | Result |
|---|---|---|
| `loadFigureFile` | Any rule in the loader order fails | Throws `FigureDataError { rule, path }` with a fixed message; returns nothing |
| `thenAndNow` | Date not a real `YYYY-MM-DD` | Throws `RangeError` naming the date argument |
| `thenAndNow` | Unknown series, empty series, nothing at or before the date | `{ found: false, reason }`, never a substitute figure |
| `demo/index.ts` | Fixture fails to load | Throws at import time, so a bad fixture fails tests and the build instead of showing wrong data |

Nothing in this module logs. Nothing in it is secret.

## Testing Strategy

- **Runner:** Vitest through `npm test`, with no network and no database (R7.1). `fast-check` and `zod` come from spec 02 task 1.
- **Example tests:**
  - Each catalogue metric passes `metricDefinitionV1Schema`, and no catalogue metric is detected as fixture.
  - Each fixture figure passes `figureV1Schema` and each fixture metric passes `metricDefinitionV1Schema`.
  - The R4 rules hold: the flag, the `FIXTURE` prefixes, round values, `retrieved_at` and the window counts.
  - Display names end with ` (fixture)` and match the catalogue name otherwise.
  - Catalogue display names contain none of a short list of change words ("rose", "fell", "soared", "plunged", "cheaper", "expensive") (R2.8).
  - The catalogue order is fixed: a snapshot of IDs in file order (R2.7).
  - One rejection example each for R1.4, R3.3, R3.5 and both R5.4 cases (R7.7).
  - `thenAndNow` on the real fixture for `2024-11-05` and `2023-10-01` gives the values in the fixture table above.
- **Property tests:** Properties 1–10 above.

## Ownership and dependencies

- Every file is under `src/lib/figures/**`, which data-dev already owns in `.github/agents.json`. **No owner path change is needed** (R5.6).
- No new dependencies. No new environment variables, Helm changes or migrations.
- **Blocked until issue 28 (spec 02-sealed-letters task 1) is merged.** It provides `figureV1Schema`, `metricDefinitionV1Schema`, `payloadV1Schema`, `canonicalize`, `zod` and `fast-check`.
- **Planned tasks (for tasks.md, after review):** two data-dev tasks, each well under 3,000 lines.
  1. Periods, fixture predicates, catalogue, loader and their tests (Properties 3, 4, 10).
  2. The fixture file, `thenAndNow`, `demo/index.ts` and their tests (Properties 1, 2, 5–9). It depends on task 1.
