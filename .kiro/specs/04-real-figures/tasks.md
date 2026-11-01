# Implementation Plan: 04 Real figures

## Overview

Each task is one GitHub issue, worked by one agent, and leaves `main` passing the CI gate. Each PR stays under 3,000 changed lines as `.github/agents.json` counts them (`package-lock.json` and `drizzle/meta/**` excluded; binary Recorded_Excerpts count as 0) and inside one role's paths plus `shared`. The estimate on each task is the expected changed-line count, based on the sizes of comparable spec 02 and spec 03 work; a task that finds it will pass about 2,500 stops and reports to the owner instead of growing. Validation always includes the CI gate; the commands below are what the agent must run locally first, ending with `bash scripts/check.sh`.

"Before this task" lists work from other specs that must be on `main` first. The exact text "Blocked by #N" in that line is what the dispatcher holds a task for; tasks 9 and 10 carry "Blocked by #49" and tasks 1 to 8 have no cross-spec blockers. "Depends on" lists only tasks in this spec. Every property test is a fast-check test tagged `// Feature: 04-real-figures, Property N: <title>`, with `numRuns: 100` unless the task says otherwise. No test makes a network request (R8.1), and a guard in the `src/lib/sources` tests fails any unstubbed `fetch`.

Follow `design.md` in this folder for every interface, algorithm, message form and file name. Follow `data-integrity.md` and `neutrality.md`: no invented, estimated, interpolated or converted number, and no output text that says a value rose, fell, improved, worsened or was corrected. Path ownership is from `.github/agents.json`: `src/lib/sources/**`, `src/lib/figures/**` and `scripts/prefetch*` are data-dev; `src/lib/personas/**`, `content/personas/**` and `src/components/**` are frontend-dev; `package.json` and `package-lock.json` are shared.

All Source_Files are downloaded from the publishers' public pages without a key (design.md "Blocker check"). If any publisher answers `401`, `403` or `407`, or the file layout differs from design.md "How each file identifies its series", the agent stops, reports the finding to the owner, and does not continue with a key, another source or a scraped page (R2.3).

## Tasks

- [x] 1. Shared source modules and the `@e965/xlsx` devDependency
  - Agent: `data-dev` · Depends on: none · Estimated size: ~1,550 changed lines
  - Before this task: none.
  - Scope: `package.json`, `package-lock.json`, `src/lib/sources/types.ts`, `errors.ts`, `fetcher.ts`, `serial-date.ts`, `decimal-rule.ts`, `test-support/workbook.ts`, `boundary.test.ts` and the `*.test.ts` for each
  - Acceptance:
    - `package.json` `devDependencies` gets exactly `"@e965/xlsx": "0.20.3"` (registry package, exact pin, no range operator) and nothing is added to `dependencies`. `package-lock.json` is committed with the matching entry (`version` `0.20.3`, `resolved` `https://registry.npmjs.org/@e965/xlsx/-/xlsx-0.20.3.tgz`, `integrity` `sha512-703RN/3OdsRD5mtse2HBX7Um7xwaP9tlswEG6svOtjqokXoX7rJdQj7DyabD2I+xk22RgaIIU+R6BHgkpZGB/w==`). `npm ci` from the committed lockfile installs it. No other dependency changes. All imports are `from "@e965/xlsx"`.
    - `types.ts`, `errors.ts` (`SourceError` with the `SourceErrorKind` values and the message rules), `fetcher.ts` (`Fetcher`, `FetchResult`, `ALLOWED_HOSTS`, `defaultFetcher`, `download`) and `serial-date.ts` (`serialToDate`) per design.md "Components and Interfaces". `download` applies R2 exactly: host check before and after redirects, `401/403/407` as `auth_required`, other non-2xx as `http_status`, thrown errors as `network` with a message that names the publisher and URL and never the library's message, empty body as `empty_body`, over 20 MB as `unreadable_file`. `defaultFetcher` sets no header, no credential and no cookie, and reads no environment variable.
    - `decimal-rule.ts`: `cellToDecimal` per design.md "Decimal_Rule", with no arithmetic, `toFixed` or rounding on the value. The `toPrecision(15)` comparison in the noise guard is only a comparison.
    - `test-support/workbook.ts`: helpers that build clearly fake `.xls` and `.xlsx` bytes with the `@e965/xlsx` writer from a description (sheet names, cells with a number, text or empty value and a display format, date serials). It is imported only by tests.
    - Example tests: each `SourceErrorKind` message names its detail and contains none of the words in the banned list; `download` for each status and for a wrong host (request and redirect target); the Decimal_Rule table from design.md (every row, with the stored number and display text written by hand), the noise examples `{ v: 1463.0100000000002, w: "1,463.01" }` and `{ v: 1751.1076729999997, w: " 1,751.11 " }`, and the error cases (text cell, empty cell, `NaN`, `Infinity`, `1e21`, `1e-7`, over 40 characters).
    - Property tests: Property 1 (the Decimal_Rule) and Property 2 (date serials; the timezone half runs with `TZ` set to `UTC`, `Pacific/Kiritimati` and `America/Adak` in child processes or `vi.stubEnv` with a fresh module, as the existing figures tests do for their date checks).
    - `boundary.test.ts` (R6.7, R13.1, R13.2, R13.3 as far as they can be checked now): no non-test file under `src/` outside `src/lib/sources/**`, and no `scripts/seal-personas*` file, imports `lib/sources` or `@e965/xlsx`; `@e965/xlsx` is not in `dependencies` and is the exact string `"0.20.3"` in `devDependencies`; `build`, `test`, `lint` and `typecheck` in `package.json` do not mention `prefetch`; no file in `src/lib/sources` imports `@/lib/crypto`, `@/lib/db` or `@/lib/letter-store`, reads `process.env`, or contains `console.`.
    - Pure modules: nothing under `src/lib/sources` is imported by the app. No `Dockerfile`, `.dockerignore` or chart change.
  - The PR description states: the lockfile `integrity` value committed and that it equals the value above; and that `npm audit` shows no advisory for `@e965/xlsx`.
  - Validation: `npm ci && bash scripts/check.sh`
  - _Requirements: R2.1, R2.3–R2.6, R3.4, R5.1–R5.6, R6.7 (boundary), R6.9, R8.1, R8.6, R13.1, R13.2, R13.5, R14.1_

- [x] 2. EIA adapter and its recorded excerpts
  - Agent: `data-dev` · Depends on: 1 · Estimated size: ~1,150 changed lines (excerpts are binary, 0)
  - Before this task: none.
  - Scope: `src/lib/sources/eia.ts`, `eia.test.ts`, `eia.property.test.ts`, `src/lib/sources/__recorded__/eia-gasoline.xls`, `eia-diesel.xls` and their `.note.txt`, `scripts/prefetch-excerpt-eia.mjs`
  - Acceptance:
    - `eiaDownloadUrl`, `parseEiaWorkbook` and `fetchEiaSeries` per design.md "EIA_Adapter": series identity from `A2`/`B2`, unit from `B3`, dates through `serialToDate`, values through `cellToDecimal`, periods before `2023-06-01` left out, empty or text value cells reported as `no_number` or `not_a_number` gaps and left out, duplicate dates and unreadable dates as errors. `downloadedAt` is the UTC time when the download finished, formatted `YYYY-MM-DDTHH:MM:SSZ`.
    - `scripts/prefetch-excerpt-eia.mjs` downloads the two real files, keeps the rows listed in design.md "Recorded excerpts", writes the `.xls` excerpts with the `@e965/xlsx` writer, reads each back and compares every kept cell's type, stored number, displayed text and number format with the original, and fails if any differs. The agent runs it once, commits the two excerpts (each at most 100,000 bytes) and the two `.note.txt` files (what R8.2 requires, plus the plain statement that these are re-encoded rows, not byte slices, per decision D4). Nothing runs the tool automatically, and no test imports it.
    - Example tests on the excerpts through a stub `Fetcher` (R8.4): the listed cells with expected strings written by hand from the publisher's displayed numbers (`3.643`, `3.069`, `4.269` for gasoline; `3.894`, `6.352` for diesel), that `2023-05-29` is left out, and that a gap made in memory is reported and left out. One failure example each (R8.5): wrong `Sourcekey`, wrong unit title, missing `Data 1`, text date cell, duplicate date, text value cell, `401`/`403` and `500` responses.
    - Property tests: Property 3 (EIA readback, over generated workbooks written as both `.xls` and `.xlsx` using `test-support/workbook.ts`) and the EIA half of Property 4 (gaps are reported and never filled).
    - The Adapter reads no environment variable, logs nothing, and calls no host other than `www.eia.gov`. `catalogue.ts` is not changed.
  - The PR description states the recording date and time (UTC) of the two excerpts and the result of the read-back comparison.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R2.1–R2.6, R3.1–R3.7, R5.5, R5.6, R8.2–R8.6, R8.9, R14.1, R14.4_

- [x] 3. Oil Bulletin adapter and its recorded excerpts
  - Agent: `data-dev` · Depends on: 1 · Estimated size: ~1,200 changed lines (the `.xlsx` excerpt is binary, 0; the HTML excerpt and the three note files are text)
  - Before this task: none.
  - Scope: `src/lib/sources/oil-bulletin.ts`, `oil-bulletin.test.ts`, `oil-bulletin.property.test.ts`, `src/lib/sources/__recorded__/oil-bulletin-prices-with-taxes.xlsx`, `oil-bulletin-page.html` and their `.note.txt`, `scripts/prefetch-excerpt-bulletin.mjs`
  - Acceptance:
    - `findBulletinLink`, `parseBulletinWorkbook` and `fetchBulletin` per design.md "Oil_Bulletin_Adapter": the page is downloaded first and exactly one link whose `filename=` is `Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx` is followed (zero or several matches is `link_not_found`); the sheet `Prices with taxes` is found by name; the two value columns are found by their header keys in row 1, never by letter or position; unit labels must be `1000 l`; column B must be `EU_` on emitted rows; dates through `serialToDate`; values through `cellToDecimal` and left in EUR per 1,000 litres; the column letters where the keys were found are returned. Periods before `2023-06-01` are left out; gaps are reported and left out; duplicate dates, `date1904` workbooks and the other failures in design.md are errors.
    - The Adapter only reports the found column letters. It does not compare them to the catalogue and changes no catalogue text; that comparison, and any correction of a column letter, is task 5 (R4.4).
    - `scripts/prefetch-excerpt-bulletin.mjs` downloads the page and the workbook and writes the byte-level excerpts per design.md "Recorded excerpts": unzip the workbook, delete rows and cells in the sheet XML as text, remove the other sheets and parts, zip it again. The agent runs it once and commits the `.xlsx` excerpt (at most 100,000 bytes), the HTML slice and the three `.note.txt` files (R8.2). The kept `<v>` texts are unchanged from the publisher's. Nothing runs the tool automatically, and no test imports it.
    - Example tests on the excerpts through a stub `Fetcher` (R8.4): the listed cells and expected strings written by hand from the publisher's displayed numbers (including the real `2026-10-26` cell stored as `1954.0378712134029`, expected `1954.037871213403`, and the `2146.1859738900539` cell, expected `2146.185973890054`), the reported column letters `C` and `D`, that `2023-05-29` is left out, and that gaps made in memory are reported and left out. One failure example each (R8.5): missing sheet, missing header key, repeated header key, unit label `1000 m`, text date cell, duplicate date, text value cell, `date1904` workbook, a page with zero and with two matching links, `403` and `500` responses, a final URL on another host.
    - Property tests: Property 5 (header keys found wherever they are) and the Bulletin half of Property 4 (gaps), over generated workbooks from `test-support/workbook.ts`.
    - The Adapter reads no environment variable, logs nothing, and calls no host other than `energy.ec.europa.eu`.
  - The PR description states the recording date and time (UTC) of the excerpts, that the xlsx excerpt is a byte-level slice, and the column letters the Adapter reported (expected `C` and `D`).
  - Validation: `bash scripts/check.sh`
  - _Requirements: R2.1–R2.6, R4.1–R4.9, R5.5, R5.6, R8.2–R8.6, R8.9, R14.1, R14.4_

- [ ] 4. Append-only refresh logic: merge, backfill refusal, serialisation
  - Agent: `data-dev` · Depends on: 1 · Estimated size: ~1,100 changed lines
  - Before this task: none.
  - Scope: `src/lib/sources/refresh.ts`, `refresh.test.ts`, `refresh.property.test.ts`
  - Acceptance:
    - `mergeRefresh` and `serialiseFigureFile` per design.md "Refresh", with the `Report` and `MergeResult` types. Existing figures are carried through unchanged (`retrieved_at` included); new figures take `retrieved_at` from the fresh series' download time and `source_url` from it; revisions, periods missing from the source and gaps are reported without touching the file; **a period that would be added but is earlier than the series' latest existing figure is a backfill: it is reported with the latest existing period, the result is `ok: false`, and no figure at all is returned**; a series with no existing figure, and the first run with no existing figures, have no backfill. Period comparison is a string comparison of `YYYY-MM-DD`.
    - `serialiseFigureFile` writes the layout and key order in design.md, one figure per line, ordered by catalogue position then period; two serialisations of the same figures are byte-identical whatever the input order. The report line forms are the ones in design.md "Report wording" (a `formatReportLine` helper builds them; no text says a value rose, fell, improved, worsened or was corrected).
    - Example tests: first run adds everything; a later week is added; a differing value is a revision and the figure stays unchanged; a source gap and a missing period keep the figure; a backfill gives `ok: false`, the backfill line, and no later period added either; a series with no existing figure next to a series with some; the second run with the same fresh data changes nothing; every report line matches its fixed form and none contains a banned direction word.
    - Property tests: Property 6 (a refresh never changes what is committed and refuses backfills) and Property 7 (serialisation is deterministic, ordered and stable), over generated existing figures and fresh data. Generated figures are clearly fake and only exist in memory.
    - Imports only `@/lib/figures` (for `CATALOGUE` and `loadFigureFile`), `@/lib/seal-format` types and `./types`; no network, no `node:fs`.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R1.9, R7.1–R7.8, R14.1–R14.3_

- [ ] 5. Prefetch script: run both Adapters, refresh, write the file
  - Agent: `data-dev` · Depends on: 2, 3, 4 · Estimated size: ~1,000 changed lines
  - Before this task: none.
  - Scope: `src/lib/sources/prefetch.ts`, `prefetch.test.ts`, `scripts/prefetch-figures.mjs`, `scripts/prefetch-figures-main.ts`, `scripts/prefetch-figures-main.test.ts`, `src/lib/sources/boundary.test.ts` (extend), `package.json`, and, only if R4.4 applies, `src/lib/figures/catalogue.ts` (see below)
  - Acceptance:
    - `runPrefetch` and `PrefetchError` per design.md "Prefetch", in this order: both Adapters; the column-letter check; building the fresh series with each download's time and the series' reference URL; `mergeRefresh` (a `backfill` result becomes `PrefetchError` of kind `backfill` carrying the report); the coverage check (earliest period on or before `2023-06-07`); `serialiseFigureFile`; `loadFigureFile(JSON.parse(text), CATALOGUE)`. It touches no file.
    - The column-letter check reads `column <LETTER> "<KEY>"` from each Bulletin catalogue entry's `series_id` text and compares it with the letter the Adapter found. A difference is `PrefetchError` `column_letter` naming both letters. Design.md records that both match today (`C` and `D`), so no catalogue edit is expected. **If a letter differs, this task corrects only that letter in the `series_id` text of that `catalogue.ts` entry and nothing else in the entry, and says so in the PR description (R4.4).**
    - `scripts/prefetch-figures.mjs` bundles `scripts/prefetch-figures-main.ts` in memory with the already-pinned `esbuild` (options in design.md), writes the one output to `node_modules/.cache/revenant/prefetch-figures.mjs` and imports it. `prefetch-figures-main.ts` reads no environment variable and no argument; reads `src/lib/figures/real/fuel-figures.json` if it exists; calls `runPrefetch`; on success writes a temporary file next to the target and renames it over it, prints the Report and exits `0` (also when revisions, gaps or missing periods were reported); on any error prints one `prefetch failed: …` line, exits `1`, and leaves the target untouched; for `backfill` and `coverage` it first prints the report lines it holds, including every `backfill` line. Its file reads and writes are injected so a test can run it without a disk.
    - `package.json` gets `"prefetch": "node scripts/prefetch-figures.mjs"` and nothing else. `build`, `test`, `lint` and `typecheck` do not run it. `esbuild` is not added or changed.
    - `boundary.test.ts` gains the `scripts/prefetch*` half of R6.7: no module under `src/app/`, `src/components/`, `src/lib/figures/` or `scripts/seal-personas*` imports `scripts/prefetch*` or `lib/sources`; `Dockerfile` and `.dockerignore` contain no `prefetch` line.
    - Tests with a stub `Fetcher` returning the Recorded_Excerpts and a fixed clock (R8.7):
      - From no file: added counts, `retrieved_at` from the clock, the would-be file loads.
      - From a file with existing figures: a second run leaves the text byte-identical; a differing value is printed as a revision and kept; a source gap is printed.
      - **A backfill: `runPrefetch` throws `PrefetchError` `backfill`; the entry prints the `backfill` line, exits `1`, calls the write function zero times; a temp-directory variant checks that the target file is byte-identical before and after.**
      - An Adapter failure leaves the file untouched; the column-letter mismatch; the coverage check; the would-be file failing `loadFigureFile` writes nothing.
      - Every printed line matches the fixed forms and no printed or error string contains a banned direction word.
    - Nothing in this task imports `src/lib/crypto`, `src/lib/db` or `src/lib/letter-store`. No `Dockerfile`, `.dockerignore` or chart change.
  - The PR description states whether R4.4 applied (expected: no catalogue change).
  - Validation: `bash scripts/check.sh`
  - _Requirements: R4.4, R6.1–R6.9, R7.1–R7.8, R8.7, R13.2, R13.5, R14.1_

- [ ] 6. The committed Real_File and its checks
  - Agent: `data-dev` · Depends on: 5 · Estimated size: ~970 changed lines (about 720 of data, about 250 of tests)
  - Before this task: none. This task needs internet access to `www.eia.gov` and `energy.ec.europa.eu`. If the agent's environment can't reach them, it stops and reports to the owner; it does not write the file by hand and does not use another source.
  - Scope: `src/lib/figures/real/fuel-figures.json`, `src/lib/figures/real/real-file.test.ts`
  - Acceptance:
    - The file is produced by running `npm run prefetch` once with no existing file, and committed as written. It is not edited by hand. It has `"fixture": false`, an empty `series` array, and 178 or more figures per catalogue series, from 2023-06-05 to the latest week the sources publish at run time, every figure on its own line, at most 1,000,000 bytes.
    - `real-file.test.ts` (offline, reads the file with `node:fs`; R8.8): it loads through `loadFigureFile(json, CATALOGUE)`; `fixture` is `false` and `series` is `[]`; every figure has `kind` `official`, one of the four catalogue IDs, a `YYYY-MM-DD` period on or after `2023-06-01`, no `FIXTURE` source or series ID, an `https` `source_url` equal to the catalogue reference URL for its series (checked against the comments in `catalogue.ts`), a `retrieved_at` matching `YYYY-MM-DDTHH:MM:SSZ` that is not `2000-01-01T00:00:00Z`, and a `period` no later than the UTC date of its `retrieved_at`; the file is at most 1,000,000 bytes; it is exactly what `serialiseFigureFile` writes from its own parsed content; each series has a period on or before `2023-06-07` and one after `2024-11-05`; weekly spacing is 7 days with no repeated period (a missing week would show as a gap); and at least 178 figures per series.
    - The file is imported by nothing but its own test in this task. `demo/index.ts` is not changed.
  - The PR description states: the printed Report (kept, added, first and last period per series, gaps, revisions, missing, no backfill); the raw size and the `gzip -9` size of the committed file; and the lines of the diff.
  - Validation: `npm run prefetch` (once, with network), then `bash scripts/check.sh`. A second `npm run prefetch` leaves the file byte-identical (run it and confirm with `git diff --stat`; do not commit a change).
  - _Requirements: R1.1–R1.10, R6.2, R7.5, R8.8, R12.2, R13.4, R14.2_

- [ ] 7. `DEMO_FIGURES` loads the real figures and the fixture together
  - Agent: `data-dev` · Depends on: 6 · Estimated size: ~700 changed lines
  - Before this task: none. (The Sealing_Script, issue #45, and the `migrate` init container step, issue #46, are merged.) Task 7, 8 and 9 merge in that order, each as its own PR.
  - Scope: `src/lib/figures/merge.ts`, `merge.test.ts`, `merge.property.test.ts`, `src/lib/figures/types.ts` (doc comment only), `src/lib/figures/demo/index.ts`, `src/lib/figures/demo/index.test.ts`, `src/lib/figures/then-now.test.ts`, `src/lib/figures/demo/personas-consistency.test.ts`
  - Acceptance:
    - `mergeLoadedFigures` per design.md "Merged_Set": series are the existing frozen `LoadedSeries` objects, not copies; an ID in both sets is allowed only when both hold the same catalogue metric object and at most one has figures; any other duplicate throws `FigureDataError("duplicate_metric_id", "merged.series.<id>")`; `merged.fixture = a.fixture || b.fixture`, with doc comments in `merge.ts` and `types.ts` saying what the flag means for a Merged_Set (R9.3); the result is frozen like a loaded file.
    - `demo/index.ts` exports `DEMO_FIGURES = mergeLoadedFigures(loadFigureFile(realFile, CATALOGUE), loadFigureFile(fixtureFile, CATALOGUE))`, with the module comment from R9.6. It imports nothing from `src/lib/sources/`, `src/lib/crypto`, `src/lib/db` or Node built-ins. The Real_File is imported only here (R13.3).
    - The only existing assertions that change are the two in D6: `holds the two fixture series (alongside the empty catalogue series)` in `demo/index.test.ts` (now: the four catalogue series have figures, the two fixture series have five each, `fixture` is `true`) and `a real catalogue series id has no figures in the demo file: no_figures` in `then-now.test.ts` (now: found, with a real figure at the date). Every other existing test passes unchanged.
    - `personas-consistency.test.ts` (R10.7, R12.1): for each persona in `PERSONAS` and each tracked metric, `thenAndNow(metric_id, written_as_of, DEMO_FIGURES).then.found` is true. It does not name any metric ID, so it passes after tasks 7, 8 and 9.
    - Payload-identity tests for Maya's fixture metrics at `2024-05-12`: `thenAndNow` on the merged set returns figure objects `===` to those from `loadFigureFile(fixture, CATALOGUE)`, and `DEMO_FIGURES.series.get(id)` is `===` the fixture-only `LoadedSeries`. (This is what makes `buildPersonaPayload` build a byte-identical payload; see design.md "Consistency".)
    - Property 8 (the merged set keeps every figure and every lookup).
    - `src/test/integration/seal-personas-core.test.ts` passes unchanged. With Postgres, `src/test/integration/seal-personas.test.ts` passes unchanged too.
  - Validation: `bash scripts/check.sh`; and with `DATABASE_URL=postgres://postgres:test@localhost:5432/revenant_test` against `postgres:17-alpine`: `npm run db:migrate`, then `npm test` (the integration test must run, not skip).
  - _Requirements: R9.1–R9.6, R9.12, R10.7, R12.1, R12.3, R13.3_

- [ ] 8. Maya moves to the catalogue metrics
  - Agent: `frontend-dev` · Depends on: 7 · Estimated size: ~150 changed lines
  - Before this task: none.
  - Scope: `content/personas/personas.json`, `src/lib/personas/schema.test.ts`, `src/lib/personas/schema.property.test.ts`, `src/lib/personas/index.test.ts`
  - Acceptance:
    - The `us-maya` entry's `metrics` become `us-gasoline-regular` then `us-diesel`, with the `recall_subject` strings unchanged (`a gallon of regular gasoline`, `a gallon of diesel`). `letter_id` is a new value generated once with `node -e "console.log(require('node:crypto').randomBytes(16).toString('base64url'))"`, accepted by `isLetterId`, different from every ID in the list and in `retired_letter_ids`. The old `wom_GdH6gqP6AGgnyhIMgA` is added to `retired_letter_ids`. `key`, `display_name`, `region`, `written_as_of` (`2024-05-12`), `opens_at` and `letter_path` are unchanged, and `content/personas/letters/us-maya.txt` is not touched.
    - The metrics and `written_as_of` are not chosen or changed because of the direction or size of any real price change (R10.5).
    - `schema.test.ts` and `schema.property.test.ts` replace `fixture-us-gasoline-regular` with `us-gasoline-regular` and `fixture-us-diesel` with `us-diesel` (including the comments that say the metrics are "fixture"), so they pass whether `DEMO_FIGURES` is the Merged_Set or the real set only. No other assertion changes.
    - `index.test.ts` gains example checks on the committed list: Maya's tracked metrics and subjects, that the old letter ID is in `RETIRED_LETTER_IDS` and not a current ID, that the new ID is valid and unused, and that `key`, `written_as_of`, `opens_at` and `letter_path` are as before (R10.1–R10.4). `personas-consistency.test.ts` from task 7 passes unchanged.
    - The old `demo_letters` row is not touched by anything in this task and no `/demo` page reaches it (R10.6); the existing Sealing_Script tests pass unchanged.
  - The PR description states the old and new letter IDs and that the old row stays in `demo_letters` (no code removes it).
  - Validation: `bash scripts/check.sh`
  - _Requirements: R10.1–R10.6, R10.8, R12.1, R12.5_

- [ ] 9. `DEMO_FIGURES` drops the fixture and the no-fixture checks
  - Agent: `data-dev` · Depends on: 8 · Estimated size: ~450 changed lines
  - Before this task: Blocked by #49 (spec 03 task 8, the reveal's figures stage), so that the reveal and its tests are on `main` when this task runs. No test outside `src/lib/figures/` and `src/lib/personas/` should read a fixture ID or value through `DEMO_FIGURES`. Run `grep -rn "fixture-us\|us-fuel.fixture" src --include=*.ts --include=*.tsx`; if it finds any such test in `src/components/**`, stop and ask the owner to have it fixed first (it belongs to frontend-dev and this task cannot edit it).
  - Scope: `src/lib/figures/demo/index.ts`, `src/lib/figures/demo/index.test.ts`, `src/lib/figures/then-now.test.ts`, `src/lib/figures/demo/no-fixture.test.ts`
  - Acceptance:
    - `demo/index.ts` exports `DEMO_FIGURES = loadFigureFile(realFile, CATALOGUE)` and no longer imports the Fixture_File, with the module comment describing the real file (R9.11). `merge.ts` stays and keeps its tests. The Fixture_File stays in the repository, unchanged (R9.9).
    - The tests in `demo/index.test.ts` and `then-now.test.ts` that read fixture IDs or values through `DEMO_FIGURES` now load the fixture themselves with `loadFigureFile(fixture, CATALOGUE)` and run against that, with the same assertions; tests about the demo use the real metric IDs (R9.10). The fixture-shape tests in `demo/index.test.ts` stay.
    - `no-fixture.test.ts`:
      - `DEMO_FIGURES.fixture` is `false`, it holds all four catalogue series with figures, and `isFixtureFigure` is false for every figure in it (R9.8).
      - **R11.1**: for every persona in `PERSONAS` and every tracked metric, the Then_Figure and Now_Figure from `thenAndNow(metric_id, written_as_of, DEMO_FIGURES)` are found and not fixture figures.
      - **R11.3**: no file under `content/personas/` or `src/app/demo/` names a metric ID that starts with `fixture-`.
      - A source scan finds no import of `src/lib/figures/demo/us-fuel.fixture.json` in a non-test file.
    - The R10.7 / R12.1 test from task 7 still passes. `src/test/integration/seal-personas-core.test.ts` and, with Postgres, `seal-personas.test.ts` pass unchanged; Maya's payload is built from the same catalogue series and figure objects as after task 8.
    - The reveal's fixture-label code and its tests stay in place (R11.4).
  - Validation: `bash scripts/check.sh`; and with `DATABASE_URL=postgres://postgres:test@localhost:5432/revenant_test` against `postgres:17-alpine`: `npm run db:migrate`, then `npm test` (the integration test must run).
  - _Requirements: R9.7–R9.12, R10.7, R11.1, R11.3, R11.4, R12.1_

- [ ] 10. Reveal shows no fixture label for the committed personas
  - Agent: `frontend-dev` · Depends on: 9 · Estimated size: ~150 changed lines
  - Before this task: Blocked by #49 (spec 03 task 8, the reveal's figures stage). `FiguresThenNow` and the fixture labelling must exist on `main`; do not write a stand-in. If its component names differ from the ones used here, use the real names and say so in the PR description.
  - Scope: one new test file under `src/components/reveal/` (for example `Reveal.real-figures.test.tsx`)
  - Acceptance:
    - R11.2: rendering the reveal's figures stage (with `renderToStaticMarkup`, no DOM library, as the other reveal tests do) for the committed `PERSONAS` and `DEMO_FIGURES`, using each persona's sealed "then" figures from `thenAndNow` and the "now" figures from `DEMO_FIGURES`, shows neither the `fixture data` label nor the fixture note, and shows the `historical record, retrieved [date]` label with the UTC date of each Then_Figure's `retrieved_at`. For each shown figure the period, unit and region are present (data-integrity.md).
    - The test reads no fixture data and adds no network request. No component code changes; if the test finds that the component fails a requirement, the agent reports that to the owner instead of changing `src/components/**` beyond this test.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R11.2_

## Notes

- **Order and merging.** Tasks 7, 8 and 9 are merged one at a time in that order. After each, `main` is consistent: every persona's metric is in `DEMO_FIGURES` and has a "then" figure, and the payload the Sealing_Script rebuilds matches the stored letter or has none stored (design.md "Consistency across tasks 7, 8 and 9"). Task 6 changes no behaviour (the file is imported only by its own test), and task 10 adds a test only.
- **Owner actions.** (1) Task 6 needs internet access; if the agent can't reach the publishers, the owner runs `npm run prefetch` and decides how to commit the file.
- **Refreshing later.** `npm run prefetch` adds new weeks and nothing else. If a source publishes a week that is earlier than a series' latest committed week, the run fails and prints a `backfill` line; nothing is written, and the owner decides what to do (design.md, D5).
- **Size.** The estimates are about 1,000 to 1,550 lines for the code tasks, so none is near the 2,500 line split threshold. Tasks 2 and 3 were kept separate because together they would be about 2,350 lines and share no files.

## Task Dependency Graph

Dependencies: 1 → 2, 1 → 3, 1 → 4, 2 → 5, 3 → 5, 4 → 5, 5 → 6, 6 → 7, 7 → 8, 8 → 9, 9 → 10. Tasks 2, 3 and 4 touch disjoint files and can run in parallel. Tasks 9 and 10 are also "Blocked by #49" (spec 03 task 8, the reveal's figures stage); that cross-spec dependency is in their "Before this task" lines, not in `Depends on`. Spec 03 task 8 carries a bullet telling its agent to load the fixture file itself, so its tests don't break task 9.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3", "4"] },
    { "id": 2, "tasks": ["5"] },
    { "id": 3, "tasks": ["6"] },
    { "id": 4, "tasks": ["7"] },
    { "id": 5, "tasks": ["8"] },
    { "id": 6, "tasks": ["9"] },
    { "id": 7, "tasks": ["10"] }
  ]
}
```
