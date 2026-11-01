# Requirements Document

Spec: 04 Real figures

## Introduction

This spec replaces the fixture behind the persona demo with real official fuel figures, so `/demo` shows real prices. The catalogue (`CATALOGUE` in `src/lib/figures/catalogue.ts`), the loader (`loadFigureFile`) and the then/now helper (`thenAndNow`) stay as they are. Only the data, the way `DEMO_FIGURES` is built, and the persona's tracked metrics change.

The spec covers:

- one source adapter per publisher in `src/lib/sources/` (`eia`, `oil-bulletin`), for the four catalogue series: US gasoline and US diesel from the U.S. EIA, and EU Euro-super 95 and EU diesel from the European Commission Weekly Oil Bulletin;
- a dev-only prefetch script under `scripts/prefetch*` that downloads the public history files and writes `src/lib/figures/real/fuel-figures.json`, the location reserved in spec 02-demo-figures;
- the committed real figure file, with every weekly figure from 2023-06-01 up to the latest published week at fetch time (this also covers the EU Persona_Window for a later EU persona);
- the move of `DEMO_FIGURES` in `src/lib/figures/demo/index.ts` from the fixture to the real file, in two steps: first it holds the Real_File and the Fixture_File together, and last it holds the Real_File only;
- moving the existing persona Maya from the fixture metric IDs to the catalogue metric IDs, with a new letter ID.

Fixture IDs (`fixture-us-…`) and catalogue IDs never clash, so `DEMO_FIGURES` can hold both for a while. That gives an order in which `main` and the deploy stay consistent after every merge, with no combined PR. The ten tasks, in order (R15.4): (1) shared source modules, (2) EIA_Adapter, (3) Oil_Bulletin_Adapter, (4) append-only refresh logic, (5) Prefetch_Script, (6) Real_File, (7) `DEMO_FIGURES` loads the Real_File and the Fixture_File together while Maya still uses fixture IDs, (8) Maya moves to catalogue IDs with a new letter ID, (9) `DEMO_FIGURES` drops the Fixture_File and the no-fixture checks are added, (10) the reveal's no-fixture check. Tasks 1 to 8 have no cross-spec blockers. Tasks 9 and 10 are blocked by #49 (spec 03 task 8, the reveal's figures stage).

The prefetch script is append-only. The Sealing_Script (`sealPersonas` in `scripts/seal-personas-core.ts`, run by the `migrate` init container) rebuilds each persona payload from `DEMO_FIGURES` and fails if it differs from the stored letter, and a failure stops the web pod from starting. So re-running prefetch must never change a figure already in the file, `retrieved_at` included, and must never add a period earlier than a series' latest figure (R7).

It builds on spec 02-demo-figures (catalogue, loader, `thenAndNow`, `isFixtureFigure`, merged) and spec 03-persona-demo (Persona_List, Sealing_Script and the `migrate` init container step, merged; the `/demo` index, merged; the persona route and reveal views, in progress). It follows `data-integrity.md`, `neutrality.md`, `product.md`, `structure.md`, `tech.md` and `deploy.md`.

## Out of scope

Sweden (stays deferred, see spec 02-demo-figures design), more personas, an EU persona, groceries, rent, a daily fetch job or CronJob, a figures database table, `/api/figures`, API keys, any change to the catalogue entries (one exception: R4.4 lets task 5 correct the column letter in the `series_id` description text of a `catalogue.ts` entry, and nothing else in the entry), to the Dockerfile, to `.dockerignore` or to the Helm chart (unless R6.8 applies), and any UI change beyond what the switch needs.

## Glossary

- **Real_File**: `src/lib/figures/real/fuel-figures.json`, the committed figure file written by the Prefetch_Script. It has `"fixture": false` and holds figures for the four catalogue series only.
- **Source_File**: A file downloaded from a publisher: the EIA history download for one series ID, or the Oil Bulletin history workbook.
- **Adapter**: The module in `src/lib/sources/` for one publisher. It downloads that publisher's Source_File and turns its bytes into figures. It is the only code that talks to that publisher (`structure.md`).
- **EIA_Adapter**: The Adapter for the U.S. EIA, covering `us-gasoline-regular` and `us-diesel`.
- **Oil_Bulletin_Adapter**: The Adapter for the Weekly Oil Bulletin, covering `eu-petrol-euro95` and `eu-diesel`.
- **Prefetch_Script**: The script under `scripts/prefetch*` that runs the Adapters and writes the Real_File. It is a dev tool, run by hand with `node` on a machine with internet access.
- **Coverage_Start**: The date `2023-06-01`. Every figure in the Real_File has a `period` on or after it.
- **Published_Cell**: One value cell of a Source_File together with its date cell.
- **Decimal_Rule**: The rule, stated in the design, that turns a Published_Cell into the figure's `value` string (R5).
- **Recorded_Excerpt**: A small slice of a real Source_File, committed as a test input and marked as recorded (R8).
- **Existing_Figure**: A figure already in the Real_File before a Prefetch_Script run starts.
- **Revision**: A period for which an Existing_Figure's `value` differs from the value the Source_File now shows for the same series and period.
- **Backfill**: A period that a refresh would add to a series that already has at least one Existing_Figure, where the period is earlier than the period of that series' latest Existing_Figure. A series with no Existing_Figure (including every series on the first run, when no Real_File exists) has no Backfill.
- **Fixture_File**: `src/lib/figures/demo/us-fuel.fixture.json`, the spec 02-demo-figures fixture.
- **Merged_Set**: The `LoadedFigures` value that `DEMO_FIGURES` holds in step 4, made from the Real_File and the Fixture_File together.
- **Persona_List**, **Sealing_Script**, **DEMO_FIGURES**, **Fixture_Figure**: as in specs 02-demo-figures and 03-persona-demo.

## Requirements

### R1. The real figure file

**User story:** As a judge, I want the demo to use real published prices with their sources, so I can check every number myself.

1. THE Real_File SHALL be committed at `src/lib/figures/real/fuel-figures.json` with a top-level `"fixture": false`, an empty `series` array (the catalogue supplies the series), and a `figures` array.
2. THE Real_File SHALL load without error through `loadFigureFile(json, CATALOGUE)`, so it passes every loader rule of spec 02-demo-figures, including `figureV1Schema`, matching `unit`, `region`, `source` and `series_id`, real periods and no duplicate period within a series.
3. EVERY figure in the Real_File SHALL have `kind` `official`, a `metric_id` that is one of the four catalogue IDs, a `period` in the form `YYYY-MM-DD`, and a `source` and `series_id` equal to the catalogue entry's. NO figure SHALL have a `source` or `series_id` that starts with `FIXTURE`.
4. EVERY figure SHALL carry a `retrieved_at` that is the real UTC time at which the Prefetch_Script downloaded the Source_File the figure came from, written as `YYYY-MM-DDTHH:MM:SSZ`, and SHALL NOT be `2000-01-01T00:00:00Z` or any other placeholder.
5. EVERY figure SHALL carry a `source_url` that is an absolute `https` URL of the publisher's page for its series: the series' history page for the two EIA series, and the Weekly Oil Bulletin page for the two EU series, as recorded in the comments of `catalogue.ts`.
6. FOR EACH of the four series, THE Real_File SHALL hold every figure that the Source_File publishes with a `period` from Coverage_Start up to the latest period the Source_File publishes at fetch time, and SHALL hold no figure with a `period` before Coverage_Start.
7. THE Real_File SHALL hold no figure with a `period` later than the UTC calendar date of its `retrieved_at`.
8. THE Real_File SHALL hold, for each series, no figure that was interpolated, extrapolated, averaged, rescaled, converted from another currency or taken from another series or region. A week that the Source_File does not publish SHALL be absent from the Real_File.
9. THE Real_File SHALL be serialised deterministically: figures ordered by the catalogue order of their series and then by `period` ascending, with each figure object on its own single line, so that the file adds at most one changed line per figure plus a fixed number of lines for the rest of the file. Two serialisations of the same figures SHALL be byte-identical.
10. THE Real_File SHALL be at most 1,000,000 bytes.

### R2. Source access

**User story:** As the owner, I want the data to come from the publishers' public files without secrets, so anyone can reproduce it.

1. THE Adapters SHALL download only the two kinds of Source_File named in the design (plus the one publisher page that links to the Oil Bulletin workbook, from which the Oil_Bulletin_Adapter reads the link and nothing else), over `https`, with no API key, token, cookie or other credential, and SHALL read no environment variable.
2. THE design SHALL record, for each Source_File, the exact download URL, the date it was confirmed, and how the file identifies its series (the series ID for EIA, the header keys for the Oil Bulletin).
3. IF a publisher answers a download with a status that asks for a key or other authentication, THEN THE Adapter SHALL stop the run with an error that names the publisher and the status, and the work SHALL NOT continue with a key, a different source or a scraped page. The design phase SHALL report this to the owner as a blocker.
4. IF a download fails with a network error, a non-2xx status, or an empty or unreadable body, THEN THE Adapter SHALL fail the run with an error that names the publisher and the URL, and SHALL return no figures.
5. THE Adapters SHALL make no request to any host other than the publisher hosts named in the design.
6. THE download function of each Adapter SHALL be replaceable by the caller, so tests give the Adapter recorded bytes and make no network request.

### R3. EIA adapter

**User story:** As the owner, I want the EIA figures read only from the series I named, so a wrong file can't pass for the right one.

1. THE EIA_Adapter SHALL return, for a given series ID, the figures of that series from the EIA history download, each as a `period` in the form `YYYY-MM-DD` equal to the date the file gives for that week, and a `value` produced by the Decimal_Rule.
2. THE EIA_Adapter SHALL check that the downloaded file names the requested series ID, and IF it names a different series ID or none, THEN THE EIA_Adapter SHALL fail with an error naming the requested and the found ID and return no figures.
3. THE EIA_Adapter SHALL check that the file's unit is dollars per gallon, and IF it is not, THEN THE EIA_Adapter SHALL fail with an error naming the found unit.
4. THE EIA_Adapter SHALL convert the file's date cells to calendar dates without any timezone shift, so the same file gives the same `period` strings on any machine timezone.
5. IF a Published_Cell has a date but no number, or a value that is not a number, THEN THE EIA_Adapter SHALL leave that period out of its result and SHALL report the period and the reason as a gap. It SHALL NOT fill the period from a neighbouring week.
6. IF a date cell cannot be read as a calendar date, THEN THE EIA_Adapter SHALL fail with an error naming the row.
7. THE EIA_Adapter SHALL return no figure for a period before Coverage_Start.

### R4. Oil Bulletin adapter

**User story:** As the owner, I want the EU columns found by their header names, so a shifted column can't silently give me the wrong price.

1. THE Oil_Bulletin_Adapter SHALL find the sheet "Prices with taxes" by its name, and find the value columns by the header keys `EU_price_with_tax_euro95` and `EU_price_with_tax_diesel`, and SHALL NOT use a column letter or position to find a value.
2. IF the sheet, a header key, or the date column is missing, or a header key appears in more than one column, THEN THE Oil_Bulletin_Adapter SHALL fail with an error naming what is missing or duplicated and return no figures.
3. THE Oil_Bulletin_Adapter SHALL check that the unit label above each of the two value columns is `1000 l`, and IF it differs, THEN THE Oil_Bulletin_Adapter SHALL fail with an error naming the found label. It SHALL NOT change the value or convert the unit (`data-integrity.md`).
4. THE Oil_Bulletin_Adapter SHALL report the column letter at which it found each header key, and IF that letter differs from the letter named in the catalogue entry's `series_id`, THEN THE Prefetch_Script SHALL fail the run with an error naming both letters, so the catalogue text is corrected before any figure is committed. Task 5 (the task that adds the comparison to the Prefetch_Script) MAY correct only the column letter in that `series_id` description text in `catalogue.ts`, and its PR description SHALL say so. Task 3 only reports the letters and changes no catalogue text.
5. THE Oil_Bulletin_Adapter SHALL give each figure a `period` in the form `YYYY-MM-DD` equal to the date in the row's date cell, converted without any timezone shift, and a `value` produced by the Decimal_Rule. The values SHALL stay in EUR per 1,000 litres exactly as published.
6. IF a Published_Cell is empty, not a number, or marked as not available, THEN THE Oil_Bulletin_Adapter SHALL leave that period out of its result and SHALL report the period and the reason as a gap.
7. IF a row's date cell cannot be read as a calendar date, THEN THE Oil_Bulletin_Adapter SHALL fail with an error naming the row.
8. IF two rows give the same date for the same column, THEN THE Oil_Bulletin_Adapter SHALL fail with an error naming the date.
9. THE Oil_Bulletin_Adapter SHALL return no figure for a period before Coverage_Start.

### R5. Exact values

**User story:** As a reader of a sealed letter, I want each stored number to be the number the publisher published, so no spreadsheet float noise ever appears in a figure.

1. THE design SHALL state the Decimal_Rule for each Adapter: exactly how a Published_Cell (a stored spreadsheet number, or its text) becomes a `value` string, and why the result is the number as published. THE design SHALL choose the rule by comparing, on the real Source_Files, the cell's formatted display text with its stored number, and SHALL pick the rule that gives the published number.
2. THE Decimal_Rule SHALL produce a `value` that matches `^-?[0-9]+(\.[0-9]+)?$` and contains no exponent, no thousands separator and no float noise (for example, a cell stored as `1463.0100000000002` that the publisher displays as `1463.01` SHALL give `1463.01`).
3. THE Decimal_Rule SHALL use no arithmetic on the cell value (no rounding by multiplication or division, no `toFixed` on a computed result, no unit rescale), so the string depends only on the stored number or text.
4. THE Decimal_Rule SHALL give the same string for the same cell on every platform and Node version the project supports.
5. FOR EACH Recorded_Excerpt cell listed in the tests, THE test SHALL compare the Adapter's `value` with an expected string written in the test from the publisher's own displayed number, including at least one cell whose stored number carries float noise, if the recorded files contain one.
6. IF a Published_Cell cannot be turned into a `value` that meets criterion 2, THEN THE Adapter SHALL fail with an error naming the series, the period and the raw cell content.

### R6. Prefetch script

**User story:** As the agent refreshing the data, I want one command that fetches, checks and writes the real figures, so a refresh is repeatable and reviewable.

1. THE Prefetch_Script SHALL live under `scripts/prefetch*`, run with plain `node` on a machine with internet access, and read no environment variable and no argument that changes what it fetches.
2. WHEN the Prefetch_Script runs, THE Prefetch_Script SHALL run both Adapters for all four catalogue series, set `retrieved_at` for each downloaded Source_File to the UTC time of its download, and write the Real_File as set out in R1 and R7.
3. IF any Adapter fails, or the run finds a Backfill (R7.8), or any check in criteria 4 or 5 fails, THEN THE Prefetch_Script SHALL print the error, exit with a non-zero status, and leave the Real_File byte-for-byte as it was before the run (including when it did not exist).
4. BEFORE writing, THE Prefetch_Script SHALL load the complete would-be file with `loadFigureFile(json, CATALOGUE)` and SHALL write only if it loads, so a bad file is never written.
5. FOR EACH series, IF the earliest figure in the would-be file has a `period` later than 2023-06-07, THEN THE Prefetch_Script SHALL fail as in criterion 3, naming the series and the earliest period found.
6. THE Prefetch_Script SHALL print, for each series, the number of figures kept, the number added, the first and last `period`, every gap from R3.5 and R4.6, every Revision from R7.3, every period missing from the source (R7.4) and every Backfill (R7.8), and SHALL print neither the full file nor any other content of a Source_File. A failed run (criterion 3) still prints the lines it had collected, including every Backfill, before it exits.
7. THE Prefetch_Script and everything it imports from `src/lib/sources/` SHALL be absent from `npm run build`, from the files `next build` bundles, and from the Docker image: no `package.json` build step runs them, and no `COPY` or `.dockerignore` exception adds them. A test in `npm test` SHALL fail if any module under `src/app/`, `src/components/`, `src/lib/figures/` or `scripts/seal-personas*` imports from `src/lib/sources/` or from `scripts/prefetch*`.
8. IF the design finds that a change to the `Dockerfile`, `.dockerignore` or the Helm chart is needed after all, THEN that change SHALL be part of the same task as the change that needs it or of an earlier task, never a later one, and any chart change SHALL update `values.yaml`, the chart README and the chart `version` in the same change (`tech.md`).
9. THE `package.json` MAY get a script entry that runs the Prefetch_Script by hand, and that entry SHALL NOT be run by `build`, `test`, `lint` or `typecheck`.

### R7. Append-only refresh

**User story:** As the owner, I want a refresh to add new weeks without touching old ones, so the sealing script and the deploy never break because the data moved.

1. WHEN the Prefetch_Script runs and the Real_File exists, THE Prefetch_Script SHALL keep every Existing_Figure exactly as it is, with every field unchanged, `retrieved_at` included, and SHALL only add figures for periods that are later than the period of that series' latest Existing_Figure. A series with no Existing_Figure takes every period the Adapter returns (this is the first-run case, which is not a Backfill). A period that would be added but is earlier than the series' latest Existing_Figure is a Backfill and is an error (R7.8), not an addition.
2. WHEN the Prefetch_Script adds a figure, THE Prefetch_Script SHALL set its `retrieved_at` to the time of the download in this run (R1.4), and SHALL leave the `retrieved_at` of every Existing_Figure alone.
3. IF the Source_File now shows a value for a period that differs from the Existing_Figure for the same series and period, THEN THE Prefetch_Script SHALL treat it as a Revision: leave the Existing_Figure as it is, print the series, the period, the committed value and the value the Source_File now shows, and SHALL NOT exit with a failure status for that reason alone.
4. IF the Source_File no longer contains a period for which the Real_File has an Existing_Figure, THEN THE Prefetch_Script SHALL keep that figure and SHALL print the series and the period as missing from the source.
5. WHEN the Prefetch_Script runs a second time against the same Source_File bytes, THE Prefetch_Script SHALL leave the Real_File byte-for-byte unchanged, whatever the `retrieved_at` of the second run would have been.
6. THE Prefetch_Script SHALL describe a Revision only by series, period and the two values, and SHALL NOT use words that say the value rose, fell, improved, worsened or was corrected (`neutrality.md`).
7. FOR ALL generated Real_Files and generated Source_File contents, a property test (at least 100 runs) SHALL check that a refresh with no Backfill leaves every Existing_Figure deep-equal to its former self, adds only periods later than the series' latest Existing_Figure, produces a file that loads through `loadFigureFile`, and that a second refresh with the same input changes nothing; and that a refresh with a Backfill produces no file and lists exactly the Backfill periods.
8. IF a refresh would add a period that is earlier than the period of the latest Existing_Figure of the same series (a Backfill), THEN THE Prefetch_Script SHALL print one line per such period (series and period, and the latest existing period), exit with a non-zero status, and leave the Real_File byte-for-byte as it was, the same way as in R6.3. THE Prefetch_Script SHALL NOT add the other new periods of the same run either. The owner then decides by hand how to handle the Backfill; this spec adds no option that overrides the check. The first run, when no Real_File exists, SHALL NOT report any Backfill.

### R8. Recorded excerpts and tests

**User story:** As the owner, I want CI to run the adapters on small recorded real files, so the tests are honest and never touch the internet.

1. THE tests SHALL run in `npm test` with no network and no database, and SHALL fail if any test makes a network request.
2. THE Recorded_Excerpts SHALL be committed under `src/lib/sources/` in a folder named `__recorded__`, each with a text file next to it that says it is a recorded excerpt of a real Source_File, gives the download URL, the UTC date and time it was recorded, which rows and columns it keeps, and says its numbers must not be used for display.
3. EACH Recorded_Excerpt SHALL be a real slice of the real file, with the sheet names, header keys, unit labels, date cells and number cells kept as published. THE excerpts SHALL NOT be edited by hand except to remove rows and columns, and SHALL be at most 100,000 bytes each.
4. THE tests for each Adapter SHALL check, on its Recorded_Excerpts: the periods and values of a listed set of cells (R5.5), that cells before Coverage_Start are left out, and that a gap cell is reported and left out.
5. THE tests SHALL check each failure case of R3 and R4 with one example each, made by removing or changing the matching part of a Recorded_Excerpt in the test (wrong series ID, wrong unit label, missing header key, duplicated header key, missing sheet, unreadable date, duplicate date, non-numeric cell).
6. THE tests SHALL check that a date cell converts to the same `period` when the test process runs with `TZ` set to `UTC`, `Pacific/Kiritimati` and `America/Adak`.
7. THE tests SHALL check R7 (the append-only rules, the second-run no-op, and that a Backfill makes the run fail with a non-zero status and leaves the Real_File byte-identical) using the Recorded_Excerpts through a replaced download function.
8. THE tests SHALL check the committed Real_File against R1.1 to R1.10 that can be checked offline: it loads through `loadFigureFile`, no figure is a Fixture_Figure, no `retrieved_at` is a placeholder, every `source_url` is an `https` URL, every `period` is on or after Coverage_Start, it is at most 1,000,000 bytes, it is serialised as R1.9 describes, and each series has a figure with a `period` no later than 2023-06-07 and a figure with a `period` after 2024-11-05.
9. NO Recorded_Excerpt and no test input SHALL be imported by code outside tests, and no test SHALL write to the Real_File.

### R9. Moving DEMO_FIGURES to the real file

**User story:** As a judge, I want the demo to read the real figures, so what I see is what the publishers published.

Transitional state (task 7):

1. THE module `src/lib/figures/demo/index.ts` SHALL build `DEMO_FIGURES` as one Merged_Set from `loadFigureFile(realFile, CATALOGUE)` and `loadFigureFile(fixtureFile, CATALOGUE)`, each loaded with its own file-level rules.
2. IF a `metric_id` appears in both files, THEN THE module SHALL fail at load with an error naming it, so fixture IDs and catalogue IDs can never mix within a series.
3. THE `fixture` flag of a Merged_Set mixes real and fixture figures, so THE design SHALL define what the flag means for a Merged_Set. THE definition SHALL keep `loadFigureFile` and `isFixtureFigure` correct per figure, SHALL NOT make any real figure look like a Fixture_Figure or any Fixture_Figure look real, and SHALL NOT make any reveal or label code depend on the set-level flag alone to decide whether a figure is fixture data.
4. WHILE Maya still uses fixture metric IDs, THE Sealing_Script SHALL rebuild the same payload for her from the Merged_Set as it did from the Fixture_File, and no stored persona letter SHALL differ.
5. THE tests that read fixture values or fixture metric IDs through `DEMO_FIGURES` SHALL keep passing unchanged, and the tests SHALL check that the Merged_Set holds all four catalogue series with figures and the two fixture series. The only existing assertions that change in this task are the two that state the catalogue series have no figures in `DEMO_FIGURES` (one in `src/lib/figures/demo/index.test.ts` and one in `src/lib/figures/then-now.test.ts`); they describe catalogue emptiness, not fixture values or IDs, and are changed to the new state.
6. THE module comment SHALL describe the Merged_Set and say that the Fixture_File is kept only until step 6.

Final state (task 9):

7. THE module `src/lib/figures/demo/index.ts` SHALL build `DEMO_FIGURES` as `loadFigureFile(realFile, CATALOGUE)` from the Real_File only, and SHALL NOT import the Fixture_File.
8. THE tests SHALL check that `DEMO_FIGURES.fixture` is `false`, that it holds all four catalogue series, and that no figure in it is detected by `isFixtureFigure`.
9. THE Fixture_File SHALL stay in the repository, unchanged, for tests that need fixture data. Tests that need fixture data SHALL load it themselves with `loadFigureFile(fixture, CATALOGUE)` and SHALL NOT read it through `DEMO_FIGURES`.
10. EVERY existing test that reads fixture values or fixture metric IDs through `DEMO_FIGURES` SHALL be changed to load the Fixture_File itself, or to the real metric IDs where the test is about the demo, in the same change as task 9 (or, for the persona tests under `src/lib/personas/`, in task 8, which comes first and works in both states). On the date of this design the tests that do so are in `src/lib/figures/` (`then-now.test.ts`, `demo/index.test.ts`) and `src/lib/personas/` (`schema.test.ts`, `schema.property.test.ts`); no test outside those two folders reads a fixture ID through `DEMO_FIGURES`. A test merged later (for example by spec 03 task 8) SHALL NOT read fixture values or IDs through `DEMO_FIGURES` either; it loads the Fixture_File itself.
11. THE module comment SHALL describe the real file, not the fixture.

In both states:

12. THE module SHALL import nothing from `src/lib/sources/`, `src/lib/crypto`, `src/lib/db` or Node built-ins, and SHALL make no network request, so it stays safe in the browser and on the server.

### R10. Persona Maya on catalogue metrics

**User story:** As a judge, I want Maya's letter to show real prices, so the gap between her memory and the record is a real one.

1. THE Persona_List entry for `us-maya` SHALL change its tracked metrics to `us-gasoline-regular` and `us-diesel`, in that order, keeping each `recall_subject` exactly as it is ("a gallon of regular gasoline" and "a gallon of diesel").
2. THE entry SHALL get a new `letter_id` that meets spec 03 R1.3 (22-character base64url decoding to 16 bytes, generated once from a cryptographic random source), has never been used for any persona, and is in neither `demo_letters` nor `letters`.
3. THE old `letter_id` (`wom_GdH6gqP6AGgnyhIMgA`) SHALL be added to `retired_letter_ids`, and the Persona_List tests SHALL pass with it there.
4. THE entry SHALL keep `key`, `display_name`, `region`, `written_as_of` (`2024-05-12`), `opens_at` and `letter_path` as they are, and the file `content/personas/letters/us-maya.txt` SHALL be unchanged.
5. THE entry's `written_as_of` and the tracked metrics SHALL NOT be chosen or changed because of the direction or size of any real price change. WHATEVER the real figures show SHALL be what the demo shows.
6. THE old fixture letter row SHALL stay in `demo_letters` with its envelope and envelope hash unchanged, and SHALL be reachable through no `/demo` page, as spec 03 R5.2 and R5.3 require.
7. THE tests SHALL check, for each persona in the Persona_List, that `thenAndNow(metric_id, written_as_of, DEMO_FIGURES).then` is found for every tracked metric, so the Sealing_Script can never report `missing_then_figure` for the committed list. This check SHALL pass after every merge of tasks 7, 8 and 9, whichever metric IDs the persona uses at that point.
8. THE tests that name fixture metric IDs for the persona schema (`src/lib/personas/*.test.ts`) SHALL use the catalogue IDs, or build their own data from the Fixture_File, in the same change.

### R11. No fixture data on the demo

**User story:** As a judge, I want no fake figure anywhere on the demo, so I never have to wonder which numbers are real.

The checks in criteria 1 and 3 are added in task 9, after Maya has moved to catalogue IDs (task 8) and `DEMO_FIGURES` has dropped the Fixture_File. The check in criterion 2 needs the reveal's figures stage (spec 03 task 8, issue #49) and is added in task 10, after task 9. Tasks 9 and 10 are both blocked by #49, so that stage is on `main` before either starts. None of them holds before then and none SHALL be added earlier.

1. THE tests SHALL check that for every persona in the Persona_List and every tracked metric, the Then_Figure and the Now_Figure that `thenAndNow(metric_id, written_as_of, DEMO_FIGURES)` returns are found and return `false` from `isFixtureFigure`. `buildPersonaPayload` copies exactly that Then_Figure into the payload with a plain spread and takes the metric from `figures.series.get(metric_id).metric`, and the reveal takes its Now_Figure from the same call, so the check covers both without importing the Sealing_Script into a data-dev test.
2. THE tests (task 10) SHALL check that rendering the reveal's figures stage for the committed Persona_List and `DEMO_FIGURES` shows neither the "fixture data" label nor the fixture note, and that each Then_Figure shows the "historical record, retrieved [date]" label with the UTC date of its `retrieved_at`.
3. THE tests SHALL check that no committed file under `content/personas/`, and no file under `src/app/demo/`, names a metric ID that starts with `fixture-`.
4. THE reveal code for fixture figures SHALL stay in place and keep its tests, since the live demo or tests may use fixture data later.

### R12. Consistency between data, list and sealed letters

**User story:** As the owner, I want the demo never to be in a state where the Persona_List and `DEMO_FIGURES` disagree, so a deploy can't leave the site down.

1. THE repository on `main` SHALL never contain a Persona_List and a `DEMO_FIGURES` that disagree. A test in `npm test` SHALL fail whenever any persona's tracked metric is not in `DEMO_FIGURES`, or has no "then" figure at the persona's `written_as_of` (R10.7), and that test SHALL pass after every merge of this spec, including tasks 7, 8 and 9, and so SHALL the deploy (the Sealing_Script rebuilds every persona payload without a mismatch).
2. THE Real_File SHALL be committed, and its tests SHALL pass, before task 7 is merged.
3. THE merge order SHALL be tasks 7, 8 and 9 as R15.4 gives them. No combined PR is needed, because fixture IDs and catalogue IDs never clash and `DEMO_FIGURES` holds both between 7 and 9. THE design SHALL show, for each of 7, 8 and 9, why `main` stays consistent after it merges, checked against the Sealing_Script and the persona tests as they are on `main`.
4. THE Prefetch_Script and the Real_File SHALL stay append-only after the switch (R7), so a later refresh never changes the payload the Sealing_Script rebuilds for a persona whose "then" figures are already in the file.
5. IF a persona's payload would need to change after it was sealed, THEN spec 03 R5.2 SHALL apply: the persona gets a new letter ID, and the old one is retired.

### R13. Dependencies and boundaries

**User story:** As the owner, I want the dev-only data tools kept out of the product, so the runtime image and the browser bundle stay as small and safe as before.

1. THE `dependencies` section of `package.json` SHALL contain no package that this spec adds. IF the Adapters need a package to read spreadsheet files, THEN THE design SHALL name the package and the exact version, give the reason, and say how its parsing keeps the Decimal_Rule exact, and the task SHALL add it to `devDependencies` only. The package is `@e965/xlsx` 0.20.3, a registry republish of the official SheetJS 0.20.3 release (the `xlsx` package on the registry stops at 0.18.5, which has known advisories), written in `devDependencies` as the exact string `"0.20.3"` with no range operator and imported as `@e965/xlsx`. It is used instead of the SheetJS tarball URL because a URL dependency would need a root `.npmrc` (owner-only) and would make every CI run and Docker build fetch from `cdn.sheetjs.com`. THE design SHALL record that the republish is byte-identical to the official tarball. THE task that adds it SHALL commit the matching `package-lock.json` entry (registry `resolved` URL and `integrity` hash) so that `npm ci` installs exactly those bytes. BEFORE choosing the package, THE design SHALL check it for known security advisories and for how current its published version is, SHALL record what it found, and SHALL prefer a CSV download over a spreadsheet package wherever the publisher offers one for the same series.
2. THE Adapters SHALL contain no secret, no logging of Source_File content beyond R6.6, and no import of `src/lib/crypto`, `src/lib/db` or `src/lib/letter-store`.
3. THE Real_File SHALL be imported by `src/lib/figures/demo/index.ts` only, and SHALL reach the browser only through `DEMO_FIGURES`, as the Fixture_File did.
4. THE design SHALL state the byte size of the committed Real_File and the effect on the size of the `/demo` client chunk, and SHALL say whether `DEMO_FIGURES` reaches the browser today. IF the Real_File grows the `/demo` client chunk by more than about 50 KB gzipped, THEN THE design SHALL propose picking each persona's figures on the server and passing only those to the browser, for the owner's decision, and SHALL NOT adopt it without that decision.
5. `npm run lint`, `npm run typecheck` and `npm test` SHALL cover the Adapters, the Prefetch_Script's testable parts and the Real_File checks, and SHALL pass with the Prefetch_Script absent from `npm run build` (R6.7).

### R14. Data honesty and neutrality

**User story:** As a judge on any side of any issue, I want the numbers shown as published, so the data says what it says without anyone steering it.

1. THE Real_File, the Prefetch_Script output, the Adapters' error messages and any new copy SHALL describe values only as numbers with their unit, region, period and source, and SHALL NOT explain or judge any change (`neutrality.md`).
2. THE Real_File SHALL hold every figure the Source_Files publish in the Coverage_Start range, whatever its value or direction, and no step SHALL leave out, reorder or choose figures because of how the price moved.
3. THE Prefetch_Script SHALL NOT convert a currency, rescale a unit, or fill a missing week; the display rescale for the EU series stays a display-time rule in `format` code (spec 02-demo-figures R2.5).
4. WHEN a figure is unavailable because the Source_File has a gap, THE Prefetch_Script SHALL report it, and the existing `thenAndNow` and reveal behaviour (showing the latest earlier figure with its own period, or "unavailable") SHALL apply unchanged.

### R15. Task split

**User story:** As the owner, I want the work split by role, so each task is one reviewable PR.

1. THE task list SHALL map each task to exactly one GitHub issue and one PR, and each PR SHALL have fewer than 3,000 changed lines, counted as `max_changed_lines` counts them in `.github/agents.json` (`package-lock.json` and `drizzle/meta/**` excluded; binary Recorded_Excerpts count as 0). THE task list SHALL give an estimated changed-line count for each task, and any task estimated above about 2,500 lines SHALL be split into separate whole-number tasks. THE one-figure-per-line format of R1.9 exists so the Real_File fits; the committed Real_File SHALL be added in its own task, separate from the Adapter code.
2. THE task list SHALL limit each task's changed files to the paths of one role in `.github/agents.json`, plus the paths listed under `shared`.
3. THE shared source modules, the Adapters (`src/lib/sources/**`), their Recorded_Excerpts, the Prefetch_Script (`scripts/prefetch*`), the Real_File and both `DEMO_FIGURES` changes, tasks 7 and 9 (`src/lib/figures/**`), SHALL be data-dev work. THE Persona_List change (`content/personas/**`), the persona test updates (`src/lib/personas/**`) and the reveal check of task 10 (`src/components/**`) SHALL be frontend-dev work. A `package.json` script or devDependency MAY be added by the data-dev task, because `package.json` and `package-lock.json` are `shared`.
4. THE planned order SHALL be: (1) the shared source modules (errors, download, date serials, Decimal_Rule, test workbook helper, boundary test, the `@e965/xlsx` devDependency); (2) the EIA_Adapter with its Recorded_Excerpts, depends on 1; (3) the Oil_Bulletin_Adapter with its Recorded_Excerpts, depends on 1; (4) the append-only refresh logic (merge, Backfill detection, deterministic serialisation), depends on 1; (5) the Prefetch_Script (`runPrefetch`, launcher, entry, `package.json` script, column-letter and coverage checks), depends on 2, 3 and 4; (6) the committed Real_File and its tests, produced by running the Prefetch_Script, depends on 5; (7) `DEMO_FIGURES` loads the Real_File and the Fixture_File together (R9.1 to R9.6), depends on 6; (8) the persona change (R10), frontend-dev, depends on 7; (9) `DEMO_FIGURES` drops the Fixture_File (R9.7 to R9.11) and the R11.1 and R11.3 checks are added, depends on 8; (10) the R11.2 reveal check, frontend-dev, depends on 9. Tasks 1 to 8 SHALL have no cross-spec blockers, since specs 02-demo-figures and 03-persona-demo tasks 1 to 6 and the persona-demo reveal flow logic are merged. Tasks 9 and 10 are each blocked by #49 (spec 03 task 8, the reveal's figures stage), and their "Before this task" lines carry the exact text "Blocked by #49".
5. TASKS 7, 8 and 9 SHALL be merged in that order, each as its own PR. Tasks 7 and 8 carry no "Blocked by" lines, and none refers to the Sealing_Script or the `migrate` init container, because both are merged (issues #45 and #46 are closed). Task 9 carries "Blocked by #49", so the reveal's figures stage and its tests are on `main` before task 9 changes `DEMO_FIGURES`.
6. THE task list SHALL give each task a "Before this task" line for cross-spec dependencies, using real issue numbers, and a "Depends on" line that lists only tasks from this spec.
