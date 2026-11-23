# Requirements Document

Spec: 18 Persona dates

## Introduction

The three persona letters (Maya, Tomás, Priya) are written as of 12 May 2024. Maya and Priya open on 5 November 2024 and Tomás on 9 June 2024. The owner wants all three written as of Sunday 17 November 2024 and opening on 17 November 2026. A two-year gap that opens this month means the figure at opening is one a visitor can check against today, and November 2024 is recent enough to remember. Tomás gets the same two years as the others.

This spec moves the dates, rewrites the three letters and their intro lines for a November Sunday, refetches the fuel data past the opening date, reseals the three letters, and makes `content/personas/personas.json` the one place a persona date is written, so the next move is a one-file change plus a reseal.

Today is 23 November 2026, so 17 November 2026 is already past. The resealed persona letters open as soon as they are stored, as today's persona letters do. No persona page shows a countdown.

November 2024 was U.S. election month. The letters, intro lines, questions, sealed answers and recollections do not mention that election or any other public event, and the banned-terms list is extended to catch it (Requirement 8).

The owner's gate: the three rewritten letters, Priya's reworded questions, answers and recollections, and every then and at-opening figure with full provenance appear in `design.md` for the owner's approval before anything is sealed (Requirement 4). The owner's Approval_Gate is the sealing gate. The copy-test reviewer result (Jacob Morgan) stays pending until he records it, and sealing does not wait for it unless the owner records that it should (Requirement 6.11). This document does not state any figure value. Every value comes from the refetched figure file, and the design quotes it.

## Code facts this spec relies on

Read from the checkout at `643aac5a` on the day this spec was written. The first task that touches an area re-reads it and reports any difference in a commit message body.

| Topic | What exists |
|---|---|
| Persona list | `content/personas/personas.json`: `us-maya` (metrics `us-gasoline-regular`, `us-diesel`), `eu-tomas` (metrics `eu-petrol-euro95`, `eu-diesel`), `us-priya` (no metrics, two `author_questions`). Each has `key`, `display_name`, `intro_line`, `region`, `letter_id`, `envelope_hash`, `written_as_of` (`2024-05-12`), `opens_at` and `letter_path`. `retired_letter_ids` lists six earlier ids. Schema: `src/lib/personas/schema.ts` (opens_at after written_as_of midnight UTC, no current id in the retired list, intro line with no digit and no political term). |
| Letters | `content/personas/letters/us-maya.txt`, `eu-tomas.txt`, `us-priya.txt`, all written for "a Sunday in May". Maya quotes "about $3.64 a gallon" (regular) and "about $3.89 a gallon" (diesel), "in the first week of May". Tomás quotes "about €1.79 a litre" (unleaded) and "about €1.65 a litre" (diesel), "in the first week of May". Priya quotes no price. |
| Priya's copy | Questions in `personas.json` (`author_questions`). Sealed answers in `letters/sealed-answers.json` (sealed, format v2). Fictional recollections in `letters/answers.json` (never sealed or stored). Both answers name "the coast", "the summer" and "the extra morning shift". |
| Sample answers | `letters/samples.json` holds four candidates per fuel metric. `src/lib/personas/spread.ts` classifies each against the then value (near within 5 %, below at most 85 %, above at least 115 %). `samples.test.ts` checks the file against the sealed then value and checks that no candidate equals the Record_Candidate. The candidates were chosen for the May 2024 figures. |
| Letter checks | `src/lib/personas/letter-checks.ts` and `banned-terms.ts`: no digit outside a price phrase (`PRICE_RE` in `price-lines.ts`), no currency word, no term from `ELECTION_PARTY_TERMS` at the start of a word. `letter-prices.test.ts` and `price-lines.test.ts` check that each price phrase matches the sealed then value shown at two decimals. |
| Copy-test records | `content/personas/letters/us-copy-test.md`, `eu-copy-test.md`, `us-priya-copy-test.md`. Each names the old dates. A pass is recorded only by a named human reviewer (Jacob Morgan). An agent self-check never counts as a pass. |
| Figure file | `src/lib/figures/real/fuel-figures.json`: 178 weekly points per series, from `2023-06-05` to `2026-10-26`, with no weekly gap. Every point has `retrieved_at` `2026-11-01T16:39:37Z` (EIA) or `2026-11-01T16:39:38Z` (Oil Bulletin). Tomás's units are EUR per 1,000 litres, shown per litre by the Display_Rescale. |
| Prefetch | `node scripts/prefetch-figures.mjs` (`scripts/prefetch-figures-main.ts`, `src/lib/sources/prefetch.ts`, `refresh.ts`). The merge is append-only: an existing point keeps its `value` and `retrieved_at`, a differing fresh value is reported as a revision and not applied, and the run exits 0 when gaps are reported. |
| Then and at opening | `thenAndNow(metricId, date, figures).then` in `src/lib/figures/then-now.ts` returns the latest figure at or before `date`. `buildPersonaPayload` in `scripts/seal-personas-core.ts` uses it with `written_as_of` for the sealed then figure. `figureAtOpening` in `src/lib/figures/at-opening.ts` uses it with the date part of `opens_at` for the at-opening figure. |
| Sealing | `scripts/seal-personas.ts` and `seal-personas-core.ts`. It runs in the web Deployment's init container when `demo.sealPersonas` is set (`deploy/helm/revenant/templates/deployment.yaml`). `sealedAt` is the clock at sealing. A stored row that differs from the freshly built payload fails with `stored_letter_differs`. `--hashes` prints each persona's id and committed hash. Persona rows live in `demo_letters`, which has an immutability trigger and no three-month lock. |
| Screen dates | `REVEAL_COPY.memoryLine` ("You lived through {month} too…", `TestifyContext.tsx`), `letterDisclosure` ("{name} is fictional. This letter was written as of {writtenAsOf}."), `writtenAsOfPrefix`, `sealedForThisDemo` ("Sealed for this demo on {sealedAt}", `SealedLetter.tsx`, filled from the header's `sealedAt`), `labelHistoricalRecord` ("historical record, retrieved {date}", `FigureLine.tsx`), and `CEREMONY_COPY.envelopeOpens` ("Opens {date}"). The values come from the persona or the sealed letter. |
| Date literals | 63 files under `src/`, `tools/` and `scripts/` contain an Old_Persona_Date. Most are tests. `src/components/ui/letter-date.ts` and `src/lib/figures/at-opening.ts` hold them in comments. `letter-date.ts` also has the comment example "Tuesday, 17 November 2026" on `formatWeekdayDate`, which holds a Date_Form of the new Opening_Date. `tools/qa/layout-gate-baseline.json` holds "Opens 5 November 2024" and "Opens 9 June 2024" in GO1 rows. Outside `src/`, the spec 15 prototype under `docs/design/15-flow/` and older specs under `.kiro/specs/` hold them. |
| Old letter ids | The three Old_Letter_Ids appear only in `personas.json`. |
| QA tools | `tools/qa/journey-check.mjs` J10 compares each persona's production `envelopeHash` with `personas.json`; J2 walks `/demo/personas/us-maya` and `eu-tomas`. `.github/workflows/journey-check.yml` runs it every six hours. `tools/qa/layout-check.mjs` pins `SAMPLE_SEED = 1`. |
| Retired phrases | `src/test/retired-phrases.test.ts` retires "U.S. presidential election day" and "European Parliament election" in every non-test file under `src/` and `content/personas/`, except the copy-test records. |
| Steering | `.kiro/steering/product.md` (Demo 1) names the fixed windows "US: up to 5 November 2024", "EU: up to 9 June 2024", "Sweden: up to 11 September 2022". `neutrality.md` says election dates set the demo persona windows. `structure.md` describes `lib/events/` as election dates for the demo windows. |
| Docs | `README.md` links to `/demo/personas/us-maya` and shows `docs/readme-hero2x.png`, and has a TODO for a ceremony screenshot. `docs/video-script.md` names no persona date or price today. |

## Decisions already made

From the owner's request:

1. All three personas: `written_as_of` `2024-11-17` (a Sunday) and `opens_at` `2026-11-17T00:00:00.000Z`.
2. The then figure is the latest record on or before the written-as-of date. The at-opening figure is the latest record on or before the opening date. This is the existing `thenAndNow` rule, unchanged.
3. The figure file is refetched past the opening date for all four series. A missing week fails the run. Nothing is estimated or carried forward.
4. The three letters, the intro lines and Priya's questions, sealed answers and recollections are rewritten for a November Sunday. A price in a letter is the new then figure, with its period named.
5. No letter, intro line, question, sealed answer or recollection mentions the November 2024 U.S. election or any other public event.
6. The three letters are resealed with new ids and hashes. The persona slugs (`us-maya`, `eu-tomas`, `us-priya`) stay.
7. The labels keep saying the people are fictional and the letters were prepared later as a demo.
8. Every persona date on screen comes from `personas.json` or the sealed letter. Tests read the dates from `personas.json`. A guard test fails on a persona date literal elsewhere.
9. Nothing is sealed until the owner approves the letters and figures in `design.md`. The copy tests are run; the human reviewer's result is recorded when Jacob Morgan gives it.

## Glossary

- **Persona**: one entry in `content/personas/personas.json`: `us-maya`, `eu-tomas` or `us-priya`.
- **Fuel_Persona**: Maya or Tomás, each tracking two fuel series.
- **Text_Persona**: Priya, with author questions, sealed answers and fictional recollections, and no figures.
- **Persona_List**: `content/personas/personas.json`.
- **Persona_Dates**: a Persona's `written_as_of` and `opens_at` in the Persona_List.
- **Written_Date**: `2024-11-17`, the new `written_as_of` of every Persona.
- **Opening_Date**: `2026-11-17T00:00:00.000Z`, the new `opens_at` of every Persona. Its date part is `2026-11-17`.
- **Old_Persona_Date**: any of these strings: `2024-05-12`, `12 May 2024`, `12 May`, `May 2024`, `2024-11-05`, `2024-11-05T00:00:00.000Z`, `5 November 2024`, `5 Nov 2024`, `2024-06-09`, `2024-06-09T00:00:00.000Z`, `9 June 2024`, `9 Jun 2024`. These are the Persona_Dates at `643aac5a` in the forms the product and its tests write them.
- **Old_Letter_Id**: any of `NvKu8C4wTJsMYe8uv1AkAQ` (`us-maya`), `zGQh3PULIzdSxkyu9elzUA` (`eu-tomas`) or `9cvEPNCigWy7H7peQprIWg` (`us-priya`), the current `letter_id` values at `643aac5a`.
- **Persona_Series**: the four series the Fuel_Personas track: `us-gasoline-regular` and `us-diesel` (U.S. EIA, Maya), `eu-petrol-euro95` and `eu-diesel` (European Commission Weekly Oil Bulletin, EU average, Tomás).
- **Then_Figure**: for one Persona_Series, the figure `thenAndNow` returns at the Written_Date: the latest figure with a period on or before `2024-11-17`.
- **Opening_Figure**: for one Persona_Series, the figure `figureAtOpening` returns at the Opening_Date: the latest figure with a period on or before `2026-11-17`.
- **Persona_Figures**: the Then_Figure and the Opening_Figure of each of the four Persona_Series: eight figures. The owner's request says "six"; four series with a then and an at-opening figure each make eight, and this spec covers all eight.
- **Figure_File**: `src/lib/figures/real/fuel-figures.json`.
- **Display_Rescale**: the display-only, exact power-of-ten rescale keyed on an exact sealed unit string, for example `EUR per 1,000 litres` shown as `EUR per litre`, as defined in spec 09 (C8). The stored value stays as published.
- **Unit_Range_Table**: the one table that maps an exact displayed unit string to a fixed recall scale range and its tick values, as defined in spec 08: `UNIT_RANGE_TABLE` in `src/components/ceremony/recall/unit-ranges.ts`.
- **Recall_Number_Parser**: the one pure module that reads the text typed into the recall number field and returns a value, an ambiguity with two readings, or a rejection, as defined in spec 08 (R32).
- **Recall_Record**: the JSON value holding a judge's recall answers, encrypted with the opening records key and stored through `POST /api/openings`, as defined in spec 03.
- **Record_Candidate**: for one Persona_Series, the Then_Figure's value as the Remember field shows it: at two decimals, after any Display_Rescale (spec 10, C5.2). For example 3.64 for Maya's regular gasoline value 3.643 at `643aac5a`. No Sample_Candidate may equal it.
- **Live_Walk**: `src/test/integration/live-walk.test.ts`, as defined in spec 14 and extended in specs 15 and 16. It runs only when `WALK=1` is set.
- **Prefetch_Script**: `node scripts/prefetch-figures.mjs` and the modules it runs.
- **Weekly_Gap**: two consecutive figures of one series, ordered by period, whose periods are not exactly 7 days apart.
- **Sealing_Script**: `scripts/seal-personas.ts` with `seal-personas-core.ts`.
- **Persona_Texts**: the three letter files, the three `intro_line` values, Priya's two `author_questions`, her two sealed answers in `sealed-answers.json` and her two recollections in `answers.json`.
- **Price_Line**: a sentence in a Fuel_Persona letter that quotes a price through `PRICE_RE`.
- **Sample_Candidates**: the four values per fuel metric in `content/personas/letters/samples.json`.
- **Banned_Terms**: `ELECTION_PARTY_TERMS` and `CURRENCY_WORDS` in `src/lib/personas/banned-terms.ts`.
- **Copy_Test**: the `neutrality.md` copy test checklist, recorded in the copy-test record of each Persona, plus the automated letter checks (`letter-checks.ts`, `letter-prices.test.ts`, `retired-phrases.test.ts`).
- **Approval_Gate**: the owner's recorded approval, in `design.md`, of the Persona_Texts and the Persona_Figures, recorded as Requirement 4.9 describes. It is the gate for sealing. The copy-test reviewer result is separate and gates sealing only under Requirement 6.11.
- **Date_Guard**: the new test of Requirement 12 that fails on a Persona_Dates literal outside the allowed files.
- **Date_Form**: one way a Persona_Dates value can be written. Each value has five Date_Forms: ISO date, ISO instant at midnight UTC, en-GB day date, en-GB short date and en-GB month. For the Written_Date these are `2024-11-17`, `2024-11-17T00:00:00.000Z`, `17 November 2024`, `17 Nov 2024` and `November 2024`; for the Opening_Date, `2026-11-17`, `2026-11-17T00:00:00.000Z`, `17 November 2026`, `17 Nov 2026` and `November 2026`. With one Written_Date and one Opening_Date shared by every Persona, that makes ten Date_Forms in all. The design lists the forms the date formatters in `src/components/ui/letter-date.ts` produce and shows that each contains one of the five (for example the weekday form "Sunday, 17 November 2024" contains the day date).
- **Persona_Screen**: `/demo`, `/demo/personas/us-maya`, `/demo/personas/eu-tomas` and `/demo/personas/us-priya` at every step.

## Proposed wording

Strings marked **(proposed)** are this spec's wording, for the owner to approve on review. Each follows `tone.md` and `neutrality.md`.

| Requirement | Key | Today | Proposed |
|---|---|---|---|
| 10 | `REVEAL_COPY.sealedForThisDemo` | Sealed for this demo on {sealedAt} | Sealed later, for this demo, on {sealedAt}. |

Why: the Sealing_Script sets `sealedAt` from its clock, so the resealed letters will show a sealing date after 23 November 2026, beside "Opens 17 November 2026". "Sealed for this demo on 25 November 2026" beside an opening date a week earlier reads as if the letter opened before it was sealed, with nothing to explain it. The word "later" says the seal was set after the letter's dates, in the same sentence. The old dates had the same gap in the other direction (sealed in 2026, opening in 2024), and it read as clearly historical. A two-year move into the present month removes that cue.

The letter text, intro lines and Priya's copy are not proposed here. The design writes them and the owner approves them at the Approval_Gate.

## Out of scope

The sealed format and every `format_version`, `src/lib/crypto/`, `src/lib/seal-format/`, the `thenAndNow` and `figureAtOpening` rules, the data source adapters, the database schema and migrations, the API routes, the Helm chart, environment variables, the live demo, real letters, any new route or dependency, any raised route budget, the persona slugs and the persona page layout. The spec 15 prototype under `docs/design/15-flow/` and earlier specs under `.kiro/specs/` keep their old dates as records, and are not edited.

## Requirements

### Requirement 1: One source for persona dates

**User Story:** As the owner, I want every persona date to live in one file, so that the next move is a one-file change plus a reseal.

#### Acceptance Criteria

1. THE Persona_List SHALL hold `written_as_of` set to the Written_Date (`2024-11-17`) and `opens_at` set to the Opening_Date (`2026-11-17T00:00:00.000Z`) for each of `us-maya`, `eu-tomas` and `us-priya`, and THE Persona_List SHALL hold no other `written_as_of` or `opens_at` value.
2. THE Persona_List SHALL keep exactly the three keys `us-maya`, `eu-tomas` and `us-priya`, so that each of `/demo/personas/us-maya`, `/demo/personas/eu-tomas` and `/demo/personas/us-priya` stays reachable at the same route.
3. THE persona schema in `src/lib/personas/schema.ts` SHALL accept the Persona_List of criterion 1.1 with its existing rules unchanged: `opens_at` later than midnight UTC of `written_as_of`, no current `letter_id` listed in `retired_letter_ids`, and an `intro_line` with no digit and no term from the Banned_Terms.
4. IF a Persona_List entry has a `written_as_of` that is not an ISO date, an `opens_at` that is not an ISO instant in UTC, or an `opens_at` that is not later than midnight UTC of its `written_as_of`, THEN THE persona schema SHALL reject the Persona_List with an error naming the Persona key and the field, and THE test suite and THE Sealing_Script SHALL exit with a failure before any Persona is sealed.
5. WHEN a Persona_Screen shows any of the date-bearing strings `REVEAL_COPY.letterDisclosure` ({writtenAsOf}), `writtenAsOfPrefix`, `REVEAL_COPY.memoryLine` ({month}) or `CEREMONY_COPY.envelopeOpens` ({date}), THE Persona_Screen SHALL fill the date from the Persona's `written_as_of` or `opens_at` in the Persona_List, or from the same field in the Persona's sealed letter payload or header, and from no date literal in any file under `src/` or `tools/`.
6. WHEN a Persona_Screen shows `REVEAL_COPY.sealedForThisDemo` ({sealedAt}), THE Persona_Screen SHALL fill {sealedAt} from the `sealedAt` of the Persona's sealed letter header.
7. WHEN a Persona_Screen formats the Written_Date or the Opening_Date, THE Persona_Screen SHALL format the UTC calendar date of the stored value, so that `us-maya`, `eu-tomas` and `us-priya` each show "17 November 2024" as the written-as-of date, "November 2024" as the {month}, and "17 November 2026" as the opening date in every browser timezone from UTC−12:00 to UTC+14:00.
8. IF the date part of the Persona's `opens_at` in the Persona_List differs from the date part of `opens_at` in the Persona's stored sealed letter header, THEN THE Sealing_Script SHALL exit with a failure naming the Persona key (`stored_letter_differs`), and THE Sealing_Script SHALL leave the stored row unchanged.
9. WHEN a Persona's `written_as_of` or `opens_at` changes in the Persona_List and the Persona is resealed, THE Persona_Screens SHALL show the new dates in every string listed in criterion 1.5, and the change SHALL need no edit to any file under `src/` or `tools/`. A test passes this criterion if it renders each Persona_Screen from a Persona_List with changed dates and finds the new dates and none of the old ones.

### Requirement 2: Refetch the four series past the opening date

**User Story:** As the owner, I want the bundled fuel data to cover the opening week, so that every persona figure is a real record and none is guessed.

#### Acceptance Criteria

1. WHEN the Prefetch_Script runs for this spec, THE Prefetch_Script SHALL fetch each of the four Persona_Series through the adapter and source that series already uses in the Figure_File (U.S. EIA for `us-gasoline-regular` and `us-diesel`, European Commission Weekly Oil Bulletin for `eu-petrol-euro95` and `eu-diesel`), and on success THE Figure_File SHALL hold, for each Persona_Series, at least one figure whose period is between `2026-11-11` and `2026-11-17` inclusive.
2. IF any Persona_Series in the merged Figure_File has a Weekly_Gap anywhere between its first period (`2023-06-05` today) and its latest period, THEN THE Prefetch_Script SHALL print one line per gap naming the series and the two periods on each side of the gap, exit with a non-zero code, and leave the committed Figure_File byte-for-byte unchanged.
3. IF a Persona_Series has no figure with a period between `2026-11-11` and `2026-11-17` inclusive after the merge, THEN THE Prefetch_Script SHALL print one line naming the series and its latest period, exit with a non-zero code, and leave the committed Figure_File byte-for-byte unchanged.
4. THE Figure_File SHALL hold only figures read from the source as published: every figure added by the run SHALL have a `value` equal to the value the source returned for that series and period, and no figure SHALL be interpolated, extrapolated, averaged, converted, rescaled or carried forward from an earlier period to fill a later one.
5. WHEN the Prefetch_Script adds a figure, THE added figure SHALL carry full provenance (`value`, `unit`, `region`, `period`, `source`, `series_id`, `source_url`, `retrieved_at`), with `retrieved_at` set to the UTC time of the download, falling between the start and end of that run. Every figure already in the Figure_File SHALL keep its committed `value` and `retrieved_at` (`2026-11-01T16:39:37Z` or `2026-11-01T16:39:38Z`).
6. WHEN the refetch returns a value for an existing series and period that differs from the committed value, THE Prefetch_Script SHALL keep the committed figure unchanged and print one revision line naming the series, the period, the committed value and the fresh value, and THE PR description SHALL list each revision line exactly as the Prefetch_Script printed it, or state that no revision was reported.
7. WHEN a Persona figure is shown with the label "historical record, retrieved {date}", THE label SHALL show the date part of the `retrieved_at` of the figure it labels. A Then_Figure and an Opening_Figure with different `retrieved_at` values SHALL show different dates.
8. THE `bundled-latest`, `real-file` and figure tests that pin the Figure_File's last period (`2026-10-26`) SHALL read the last period from the Figure_File, or be updated to the new last period, with the reason named in a commit message body.
9. IF fetching any Persona_Series fails (network error, an error response from the source, a missing API key, or a response the adapter cannot parse), THEN THE Prefetch_Script SHALL print one line naming the series and the kind of failure without printing any secret value, exit with a non-zero code, and leave the committed Figure_File byte-for-byte unchanged.
10. IF a figure the Prefetch_Script would add has a `unit`, `region`, `source` or `series_id` that differs from the figures already in the Figure_File for that Persona_Series, THEN THE Prefetch_Script SHALL print one line naming the series, the period and the differing field, exit with a non-zero code, and leave the committed Figure_File byte-for-byte unchanged.

### Requirement 3: The then and at-opening figures

**User Story:** As a judge, I want the then and at-opening figures to follow one plain rule, so that I can check them against the source.

#### Acceptance Criteria

1. WHEN the Sealing_Script builds a Fuel_Persona payload, THE Sealing_Script SHALL seal, for each of that Persona's two Persona_Series, the Then_Figure that `thenAndNow(metricId, "2024-11-17", figures).then` returns. The sealed figure SHALL keep every provenance field exactly as stored in the Figure_File: `value` at full published precision, `unit`, `region`, `period`, `source`, series ID, `source_url` and `retrieved_at`. Its `period` SHALL be on or before `2024-11-17`.
2. WHEN a Fuel_Persona page shows its figures, THE Fuel_Persona page SHALL show, for each Persona_Series, the Opening_Figure that `figureAtOpening(metricId, "2026-11-17T00:00:00.000Z", figures)` returns from the Figure_File. Its `period` SHALL be on or before `2026-11-17`, and no figure with a later period SHALL be shown as the Opening_Figure, even if the refetched Figure_File holds later weeks.
3. IF the Then_Figure is missing for any Persona_Series of a Fuel_Persona, THEN THE Sealing_Script SHALL fail that Persona with `missing_then_figure`, SHALL store no `demo_letters` row for it, SHALL exit with a non-zero status, and SHALL NOT seal any substitute, estimated or carried-forward value.
4. THE Fuel_Persona page SHALL show each Then_Figure and Opening_Figure with that figure's own period, unit and region next to the value. The source SHALL be one tap or click away. For the two `eu-*` series, the value SHALL be shown per litre by the Display_Rescale, the rescale SHALL be stated on screen, and the stored value SHALL stay per 1,000 litres as published.
5. WHEN a Fuel_Persona page shows the change between a Then_Figure and its Opening_Figure, THE Fuel_Persona page SHALL show the change as computed by `src/lib/figures`, together with the formula, a link to each input, and the periods of both inputs (for example "+N % · {then period} to {opening period}"). Rounding SHALL happen only at display.
6. THE Text_Persona SHALL seal no figure, as today.
7. IF the Opening_Figure is missing for a Persona_Series, THEN THE Fuel_Persona page SHALL show the existing "no figure" gap with the reason for that series, SHALL still show the sealed Then_Figure with its period, unit and region, and SHALL show no change line and no value in place of the missing figure.
8. IF a Then_Figure and its Opening_Figure differ in unit, region or series ID, THEN THE Fuel_Persona page SHALL say the two figures are not comparable, SHALL show both raw figures with their own periods, and SHALL show no change line.

### Requirement 4: The owner approves before anything is sealed

**User Story:** As the owner, I want to read the rewritten letters and every figure with its source before sealing, so that nothing is sealed that I have not seen.

#### Acceptance Criteria

1. THE design document `.kiro/specs/18-persona-dates/design.md` SHALL contain each Persona_Text exactly as it will be committed: the full text of each of the three rewritten letters, the three new `intro_line` values, Priya's two `author_questions`, her two sealed answers and her two recollections. Each SHALL be given in a fenced block whose content matches the committed file or field character for character, including line breaks and punctuation.
2. THE design document SHALL contain a table of the eight Persona_Figures. Each row SHALL give the persona, the metric id, whether it is the Then_Figure or the Opening_Figure, the `value` as stored, the value as shown, `unit`, `region`, `period`, `source`, `series_id`, `source_url` and `retrieved_at`. Every field except "value as shown" SHALL be copied from the refetched Figure_File. "Value as shown" SHALL be the stored value after any Display_Rescale, at two decimals, in the form the reveal displays it.
3. THE design document SHALL contain, for each Price_Line, the sentence as written in the letter, the Then_Figure it quotes (metric id, value as shown and period), and the period the sentence names. The price in each Price_Line SHALL equal that Then_Figure's value as shown, and the named period SHALL be the Then_Figure's `period`.
4. THE design document SHALL contain the four new Sample_Candidates for each of the four fuel metrics, and for each candidate its spread class against its Then_Figure (near, below or above, as `src/lib/personas/spread.ts` defines them).
5. THE design document SHALL contain the agent's self-check of the Copy_Test for every Persona_Text (Requirement 9), labelled as an agent self-check and not as a pass.
6. WHILE the Approval_Gate is not recorded in `design.md`, THE tasks SHALL NOT change a letter file, `sealed-answers.json`, `answers.json`, `samples.json`, an `intro_line`, an `author_questions` entry, a `letter_id`, an `envelope_hash` or the Persona_Dates in the Persona_List, and SHALL NOT run the Sealing_Script against any database. Running the Prefetch_Script and committing the refetched Figure_File are allowed before the Approval_Gate.
7. IF a figure value in the design differs from the committed Figure_File, THEN THE task that commits the Figure_File SHALL stop, report the persona, metric id, design value and file value, correct the design to the file value, and request the Approval_Gate again. Any approval already recorded SHALL no longer count.
8. THE values in the design SHALL be read from the refetched Figure_File. No requirement, task or design value SHALL be typed in from memory, a news report or an estimate.
9. THE Approval_Gate SHALL count as recorded only when `design.md` holds the owner's name, the approval date and the commit id of the `design.md` version approved, written by the owner. An agent SHALL NOT write or edit the Approval_Gate entry. The recorded Approval_Gate is the gate for sealing; the copy-test reviewer result is not part of it unless the owner records that it is (Requirement 6.11).
10. IF a Persona_Text, a Persona_Figure row, a Price_Line entry or a Sample_Candidate in `design.md` changes after the Approval_Gate is recorded, THEN THE Approval_Gate SHALL no longer count, and THE tasks SHALL treat it as not recorded (criterion 6) until the owner records it again for the changed version.
11. IF a committed Persona_Text or Sample_Candidate differs from the version in the approved `design.md`, THEN THE task SHALL NOT run the Sealing_Script, SHALL report each difference by file and field, and SHALL request the Approval_Gate again.

### Requirement 5: Three letters for a November Sunday

**User Story:** As a judge, I want each letter to read as written on a November Sunday in 2024, so that the letter fits its date.

#### Acceptance Criteria

1. THE three letter files SHALL each place the letter on a Sunday in November, and SHALL each describe at least one of weather, daylight or a plan for the day or the coming weeks, placed in November in the Persona's region. The words "Sunday" and "November" may appear and are not required.
2. THE three letter files SHALL contain no month name from January to September (with "May" checked only where it is used as the month, not as the verb), and no whole word "spring", "summer", "springtime" or "summertime", in any letter case. This criterion applies to the letter files only; Priya's questions, sealed answers and recollections follow Requirement 6.
3. THE three letters SHALL keep each Persona's situation, with every element below named in its letter, unless the owner records a change at the Approval_Gate:
   - Maya: early shifts at a clinic, the drive in, and Saturday deliveries with Jess.
   - Tomás: shifts at a hospital pharmacy, the car, and the market with Inês.
   - Priya: a Saturday class, a plan with her sister, and a choice at work.
4. THE Maya and Tomás letters SHALL each contain at most one Price_Line per Persona_Series that Persona tracks, so at most two Price_Lines per letter. Each Price_Line SHALL name its fuel in words: regular gasoline or diesel for Maya, unleaded or diesel for Tomás.
5. THE Price_Line of a Persona_Series SHALL quote that series' Then_Figure as shown at two decimals, after any Display_Rescale (EUR per 1,000 litres shown per litre for Tomás). It SHALL quote no other value.
6. THE Price_Line of a Persona_Series SHALL name the Then_Figure's period in words, with no digit outside the price phrase. The words SHALL name the month of the period's start date and its week of the month. The week is "first" for days 1 to 7, "second" for days 8 to 14, "third" for days 15 to 21, "fourth" for days 22 to 28 and "fifth" for days 29 to 31, in the same style as today's "in the first week of May".
7. THE Text_Persona letter (`us-priya.txt`) SHALL contain no Price_Line and no digit.
8. WHEN the letter checks (`letter-checks.ts`, `letter-prices.test.ts`, `price-lines.test.ts`) run on the three rewritten letters, they SHALL pass. That means no digit outside a Price_Line, no word from `CURRENCY_WORDS`, no match of the Banned_Terms (as extended by Requirement 8) at the start of a word, and each Price_Line equal to the Then_Figure read from the refetched Figure_File.
9. IF any letter check fails on a letter, or the Figure_File gives no Then_Figure for a Persona_Series that letter quotes, THEN that letter SHALL NOT be presented at the Approval_Gate or sealed, and the failing check SHALL name the letter file and the failing rule.
10. THE three letters SHALL each be plain text of 1 to 5,000 characters, counted in Unicode code points, with no HTML tags and no Markdown syntax (headings, emphasis markers, list markers or links).
11. THE three letters SHALL follow `tone.md` and `neutrality.md`. Each SHALL be about everyday life only, contain no exclamation mark, contain no word that judges a price or a change as good or bad (for example "soared", "finally", "cheap", "expensive", "too much"), and contain no stereotype tied to region, class, age or background.
12. THE copy-test record of each Persona (`us-copy-test.md`, `eu-copy-test.md`, `us-priya-copy-test.md`) SHALL name the Written_Date and the Opening_Date, SHALL hold the agent self-check of the rewritten letter (Requirement 9.3), and SHALL show the reviewer result as pending until Jacob Morgan records pass or fail (Requirement 9.5). An agent self-check SHALL NOT count as a pass. Sealing waits for the reviewer result only under Requirement 6.11.
13. THE three letters SHALL name no public event of November 2024 or later. That covers any election, vote, ballot, poll, result, inauguration, strike, summit, sporting final or news story, and any public holiday or national observance (for example Veterans Day, Remembrance Sunday, Thanksgiving, Black Friday, Christmas or New Year).

### Requirement 6: Intro lines and Priya's copy

**User Story:** As a judge, I want the intro line and Priya's questions and answers to match the letter's season, so that the persona reads as one person on one day.

#### Acceptance Criteria

1. THE three `intro_line` values in the Persona_List SHALL each be 1 to 160 characters long, SHALL contain no digit and no Banned_Terms match (including the terms Requirement 8 adds), SHALL name no month other than November and no season other than autumn, fall or winter, and SHALL name no public event (election, vote, holiday, sporting event, ceremony or named news event).
2. THE Text_Persona's two `author_questions` SHALL each be 1 to 200 code points long, SHALL be written in the first person and the present tense, SHALL carry no date of their own, and SHALL name no month other than November and no season other than autumn, fall or winter.
3. THE Text_Persona's two sealed answers SHALL each be 1 to 1,000 code points long and not only whitespace, and her two recollections SHALL each be 1 to 1,000 code points long and not only whitespace. Each sealed answer and each recollection SHALL name no month other than November and no season other than autumn, fall or winter. At `643aac5a` both sealed answers and both recollections name "the summer", so all four SHALL be rewritten.
4. THE Text_Persona's sealed answers and recollections SHALL contain no price, no digit and no Banned_Terms match (including the terms Requirement 8 adds), and SHALL name no public event (election, vote, holiday, sporting event, ceremony or named news event).
5. THE Text_Persona's sealed answers and recollections SHALL differ from her letter only in a detail, the order of details or the emphasis, as `neutrality.md` allows, and SHALL contain no wording that calls any answer or recollection right, wrong, close, off or accurate.
6. WHILE a Persona_Screen for `us-priya` shows one or more of the Text_Persona's recollections, THE Persona_Screen SHALL show a label saying the recollections are fictional on that same screen, at every step that shows a recollection.
7. THE Persona_List SHALL hold exactly two `author_questions` for the Text_Persona, `sealed-answers.json` SHALL hold exactly two sealed answers and `answers.json` SHALL hold exactly two recollections, where the sealed answer and the recollection at position N belong to the question at position N, for N of 1 and 2.
8. IF an `intro_line` breaks criterion 1, or a Text_Persona question, sealed answer or recollection breaks criterion 2, 3, 4 or 7, THEN the automated Copy_Test SHALL fail with a message naming the Persona key, the field and the rule broken, AND the Sealing_Script SHALL seal no Persona letter in that run and SHALL leave every stored persona row unchanged.
9. WHEN the Persona_Texts named in this requirement are rewritten, THE copy-test record for each Persona (`us-copy-test.md`, `eu-copy-test.md`, `us-priya-copy-test.md`) SHALL name the Written_Date and the Opening_Date instead of the old dates, SHALL hold the agent self-check (Requirement 9.3) of the new intro line and, for `us-priya`, of the new questions, sealed answers and recollections, and SHALL show the reviewer result as pending until Jacob Morgan records pass or fail (Requirement 9.5). An agent self-check SHALL NOT count as a pass.
10. IF the approved `design.md` does not quote the new intro lines and the Text_Persona's two questions, two sealed answers and two recollections word for word, THEN no Persona letter SHALL be sealed with that text.
11. WHERE the owner has recorded in `design.md` that sealing waits for the copy-test reviewer, THE tasks SHALL NOT run the Sealing_Script until Jacob Morgan has recorded a pass in each copy-test record for every Persona_Text of that Persona and for the line of Requirement 10.5. Without that record, sealing waits only for the Approval_Gate (Requirement 4.9), and a pending reviewer result does not block it.

### Requirement 7: Sample answers for the new figures

**User Story:** As a judge on a fuel persona, I want sample answers that fit November 2024, so that a sample is a plausible starting point and not a hint.

#### Acceptance Criteria

1. WHEN the Persona_Dates move to the Written_Date, THE Sample_Candidates for each of the four Persona_Series SHALL be replaced in `content/personas/letters/samples.json`, under the same persona keys (`us-maya`, `eu-tomas`) and metric ids as today. Each list SHALL hold exactly four distinct values. Each value SHALL be a plain non-negative decimal with exactly two decimals, inside the Unit_Range_Table range for the metric's display unit, and SHALL read back as itself through the Recall_Number_Parser and the Recall_Record rule.
2. THE Sample_Candidates for each Persona_Series SHALL be classified by `classifyCandidate` in `spread.ts` against the new Then_Figure as the Remember field shows it. For Tomás's two series that means after the Display_Rescale from EUR per 1,000 litres to EUR per litre. Each list SHALL contain at least one value classified `near` (within 5 % of the shown Then_Figure), at least one `below` (at most 85 % of it) and at least one `above` (at least 115 % of it).
3. THE Sample_Candidates SHALL NOT contain a value equal to the Record_Candidate for the same Persona_Series.
4. THE Sample_Candidates SHALL be chosen only after the Figure_File has been refetched (Requirement 2). Each value SHALL be written by the design from the shown Then_Figure quoted in `design.md` and listed there next to its class, so that the owner sees them at the Approval_Gate. No candidate value SHALL be taken from the May 2024 figures or from any source other than the refetched Then_Figure.
5. THE samples tests SHALL read each Then_Figure from the Figure_File through `thenAndNow` at the Written_Date in the Persona_List. The check in `samples.test.ts` that lists the four shown Then_Figures (today a literal list `["1.65", "1.79", "3.64", "3.89"]`) SHALL hold the four new values exactly as `design.md` quotes them at two decimals. A test run with any Sample_Candidate that breaks criteria 1 to 3 SHALL fail and name the persona key and metric id.
6. IF a Then_Figure cannot be found for a Persona_Series at the Written_Date, THEN THE samples tests SHALL fail and name the metric id, and THE Sample_Candidates for that series SHALL NOT be written.
7. THE sample label, the sample pick rule (`sample-seed.ts`, including the pinned `SAMPLE_SEED = 1` used by `tools/qa/layout-check.mjs`), the rule that Sample_Candidates are shown on the Remember step and never sealed or stored, and the neutrality rule that no sample or answer is called right, close, near, wrong, off or accurate in the UI or in persona copy SHALL stay as they are. The class names `near`, `below` and `above` SHALL appear only in code and tests, never on a Persona_Screen.

### Requirement 8: Banned terms cover election month

**User Story:** As the owner, I want the banned-terms check to catch the November 2024 election and other public events, so that a rewritten letter cannot mention one by accident.

#### Acceptance Criteria

1. THE Banned_Terms SHALL include, in `ELECTION_PARTY_TERMS`, at least the following entries, in addition to every entry it holds at `643aac5a`: `electoral`, `inaugurat`, `ballot` (already present, kept), `poll`, `polls`, `referendum`, `midterm`, `primaries`, `caucus`, `swing state`, `thanksgiving`, `veterans day`, `armistice`, `remembrance`, `black friday` and `holiday`. The design SHALL list the final set of entries and state the matching rule for each one.
2. THE Banned_Terms SHALL match every entry case-insensitively, using these rules:
   - Each single-word entry other than `poll` and `polls` matches at the start of a word, so inflected forms match (for example "inaugurated", "holidays", "caucuses").
   - `poll` and `polls` match only as whole words.
   - Each two-word entry (`swing state`, `veterans day`, `black friday`) matches when its two words are separated by one or more whitespace characters, including a line break. The `veterans day` entry also matches with an apostrophe before or after the "s" ("veteran's day", "veterans' day").
3. WHEN the letter-check tests run, THE tests SHALL include one positive and one negative case:
   - For each entry added under criterion 1, at least one example sentence that the entry matches, with the matched term named in the problem.
   - At least these ordinary words, none of which matches any Banned_Terms entry: "pollen", "pollinate", "electric", "selection", "primary", "remember", "remembered", "black", "Friday", "state", "day" and "holy".
4. WHEN the letter-check tests run on the approved Persona_Texts, THE extended Banned_Terms SHALL match no word in any of them: the three letter files, the three `intro_line` values, Priya's two `author_questions`, her two sealed answers in `sealed-answers.json` and her two recollections in `answers.json`.
5. THE extended Banned_Terms SHALL be used by every check of a Persona_Text: `checkLetterText` for the three letter files, the `intro_line` rule in `src/lib/personas/schema.ts`, `checkAnswerText` for Priya's sealed answers and recollections, and a check of Priya's `author_questions`. No check of a Persona_Text SHALL keep a separate or shorter list of election or public-event terms.
6. THE `RETIRED_PHRASES` list in `src/test/retired-phrases.test.ts` SHALL still hold both of its retired opening events, "U.S. presidential election day" and "European Parliament election", and SHALL keep applying them to the same files as at `643aac5a`.
7. IF a Persona_Text matches a Banned_Terms entry, THEN THE check SHALL fail the test run and report a problem that names:
   - the matched term as it is written in the text;
   - for a letter file, the file path under `content/personas/` and the 1-based line number of the match;
   - for a text held in JSON, the file path, the persona key, the field (`intro_line`, `author_questions`, sealed answer or recollection) and the 1-based item index.
8. THE vocabulary used to build clean text in `src/lib/personas/letter-checks.property.test.ts` SHALL contain no word that any entry of the extended Banned_Terms matches, so that the clean-text property still passes with the extended list.

### Requirement 9: Copy tests on every Persona_Text

**User Story:** As the owner, I want a copy test on every rewritten text, so that every letter is checked against neutrality before it is sealed.

#### Acceptance Criteria

1. THE three copy-test records (`us-copy-test.md` for `us-maya`, `eu-copy-test.md` for `eu-tomas`, `us-priya-copy-test.md` for `us-priya`) SHALL each list, in their persona labels section, the Persona's `written_as_of` as `2024-11-17` and `opens_at` as `2026-11-17T00:00:00.000Z`, each marked as a plain date with no event name. Outside the history kept under criterion 6, that section SHALL contain none of `2024-05-12`, `2024-11-05` or `2024-06-09`.
2. THE copy-test record of each Persona SHALL list every Persona_Text of that Persona under "Texts under review": for each Fuel_Persona, the letter file by path and the `intro_line` quoted in full; for the Text_Persona, the letter file by path, the `intro_line` and both `author_questions` quoted in full, and both sealed answers and both recollections by file path and persona key. All are as they stand at the commit that requests the Approval_Gate.
3. FOR EACH Persona_Text, THE copy-test record SHALL hold the agent's answer and the expected answer to every checklist question listed in that record. For a letter the record SHALL give these per sentence and quote each sentence as written. For any other Persona_Text the record SHALL give them per text. The section SHALL be headed as an agent self-check that does not count as a pass.
4. IF the agent's answer to any checklist question differs from the expected answer, or the agent finds a sentence that a Copy_Test rule may reject, THEN THE copy-test record SHALL name the Persona_Text, the sentence and the question under a list of points for the reviewer, and THE Approval_Gate SHALL NOT be requested until that Persona_Text is rewritten and its self-check is run again, or the point is listed in `design.md` for the owner to decide.
5. THE copy-test records SHALL name Jacob Morgan as the reviewer and SHALL show the reviewer result as pending until Jacob Morgan records pass or fail. No commit by an agent SHALL set the reviewer result to pass or fail, and an agent self-check SHALL NOT count as a pass. A pending reviewer result does not block sealing unless Requirement 6.11 applies.
6. THE copy-test records SHALL remove the line "Opens: 2024-11-05T00:00:00.000Z (U.S. presidential election day, 2024-11-05)" from `us-copy-test.md` and the line "Opens: 2024-06-09T00:00:00.000Z (European Parliament election, 2024-06-09)" from `eu-copy-test.md`. They SHALL keep each section "Removal of the opening event (spec 10 X4, issue #300)", with its wording unchanged, under a label saying spec 18 replaced its dates.
7. THE automated Copy_Test checks (`letter-checks`, `letter-prices`, `price-lines`, `retired-phrases` and the `intro_line` rules of the Persona_List schema) SHALL pass on every Persona_Text at the commit that requests the Approval_Gate.
8. IF any automated Copy_Test check fails on a Persona_Text, THEN THE Approval_Gate SHALL NOT be requested, and the failing check and Persona_Text SHALL be named in the commit message body of the commit that revises the text.
9. WHEN a Persona_Text changes after its self-check or its reviewer result was recorded, THE copy-test record of that Persona SHALL replace the self-check of the changed text with a new one under criterion 3, and SHALL set the reviewer result for that Persona back to pending.
10. THE copy-test records SHALL describe the period of each Price_Line in the self-check by the Then_Figure's period from the Figure_File. No wording note SHALL still refer to "the first week of May" or to a 2024-05 period.

### Requirement 10: Labels stay honest

**User Story:** As a judge, I want the labels to say plainly that the people are fictional and the letters were prepared later, so that nothing claims to be sealed in 2024.

#### Acceptance Criteria

1. THE Persona_Screen SHALL show, on every step where it shows them today, the existing `letterDisclosure` label (the Persona is fictional and the letter was written as of `{writtenAsOf}`) and the existing `writtenAsOfPrefix` label, with `{writtenAsOf}` filled from the Persona's `written_as_of` in the Persona_List (the Written_Date) through the existing date formatter.
2. WHILE the Text_Persona's recollections are shown, THE Persona_Screen SHALL keep the existing label that names each recollection as fictional on every step that shows a recollection.
3. THE Persona_Screen SHALL NOT show, at any step, text that pairs a form of the word "seal" with any Date_Form of the Written_Date or with the year 2024. Wording such as "sealed on 17 November 2024", "sealed in November 2024" or "sealed in 2024" fails this criterion.
4. THE Persona_Screen SHALL NOT show any sealing date other than the `sealedAt` value in the sealed letter's header. Showing the Written_Date or the Opening_Date in any Date_Form as the sealing date fails this criterion.
5. WHEN the sealed-for-demo line is shown, THE Persona_Screen SHALL show it as **(proposed)** "Sealed later, for this demo, on {sealedAt}.", with `{sealedAt}` taken from the sealed header and formatted by the same date formatter as the "Opens {date}" label, unless the owner records other wording in `design.md` on review. Any replacement wording SHALL still meet criteria 3 and 4.
6. IF the sealed header has no `sealedAt` value, or the value cannot be parsed as a date, THEN THE Persona_Screen SHALL leave out the sealed-for-demo line and SHALL NOT put the Written_Date, the Opening_Date or the current date in its place. Every other label and step SHALL stay as it is.
7. THE Persona_Screen SHALL show the "historical record, retrieved {date}" label next to each of the eight Persona_Figures wherever that figure is shown, with `{date}` taken from that figure's own `retrieved_at` and not from `sealedAt`, the Written_Date or the Opening_Date, as `data-integrity.md` requires.
8. THE line of criterion 5 SHALL meet `tone.md`, `neutrality.md` and the Copy_Test, as every other string does. Before any Persona is resealed, the copy-test record of each Persona SHALL hold the agent self-check of this line (Requirement 9.3) and a reviewer result for it, shown as pending until Jacob Morgan records pass or fail (Requirement 9.5). An agent self-check does not count as a pass. Sealing waits for Jacob Morgan's result only under Requirement 6.11.

### Requirement 11: Reseal the three letters

**User Story:** As the owner, I want the three letters resealed with new ids, so that the stored letters match the new dates and texts.

#### Acceptance Criteria

1. WHEN the Approval_Gate is recorded, THE Persona_List SHALL give each Persona a new `letter_id` that the `demo_letters_id_format` check accepts. The three new ids SHALL be distinct from each other, from every id already in `retired_letter_ids` and from every id stored in `demo_letters`.
2. WHEN the Approval_Gate is recorded, THE Persona_List SHALL add the three Old_Letter_Ids (`NvKu8C4wTJsMYe8uv1AkAQ`, `zGQh3PULIzdSxkyu9elzUA`, `9cvEPNCigWy7H7peQprIWg`) to `retired_letter_ids` and SHALL keep every id already in that list. The Persona_List schema check SHALL pass afterwards.
3. WHILE the Approval_Gate is not recorded, THE Sealing_Script SHALL NOT be run with the new Persona_Texts or Persona_Dates against any environment, and THE Persona_List SHALL keep the three current ids and hashes.
4. WHEN the Sealing_Script runs after the Approval_Gate, THE Sealing_Script SHALL seal each Persona with the following, and nothing else:
   - the Persona_Texts exactly as approved at the Approval_Gate;
   - the Persona_Dates of Requirement 1.1 (Written_Date `2024-11-17`, Opening_Date `2026-11-17T00:00:00.000Z`);
   - for each Fuel_Persona, the Then_Figure of each of its two Persona_Series from Requirement 3.1, with its value, unit, region, period, source, series ID, `source_url` and `retrieved_at` exactly as they appear in the Figure_File;
   - the published demo key and the existing format version.

   The Text_Persona letter SHALL hold no figure.
5. WHEN a Persona's new row is stored on production, THE Persona_List SHALL record that Persona's `envelope_hash` as the hash the production row reports. WHEN the journey check next runs against production, J10 SHALL report a match for all three Personas.
6. WHEN the Sealing_Script runs, THE Sealing_Script SHALL only insert new `demo_letters` rows. No task in this spec SHALL update, delete or truncate a `demo_letters` or `openings` row. After the reseal, the three rows with the Old_Letter_Ids SHALL still be stored with their original envelope hashes, and the number of `demo_letters` rows SHALL be the count before the reseal plus exactly three.
7. THE repository, outside the Persona_List's `retired_letter_ids` and outside `.kiro/specs/`, SHALL contain no link, path or literal for any id in `retired_letter_ids`. A test SHALL read every id from `retired_letter_ids` and fail if any of them appears in a tracked file outside those two places.
8. IF the Sealing_Script reports `stored_letter_differs`, `real_letter_collision`, `missing_then_figure` or any other failure for a Persona, or exits with a non-zero code, THEN the task SHALL stop. It SHALL report the Sealing_Script's result line for that Persona and SHALL NOT record that Persona's hash in the Persona_List. The Persona_List entries of the Personas that did not fail SHALL be left as the run recorded them.
9. WHEN a resealed persona letter is opened on its Persona_Screen, THE persona page SHALL load the letter whose `letter_id` the Persona_List gives for that slug, verify its envelope hash against the stored hash, and show the seal as intact, as it does today.
10. IF the envelope hash of a resealed persona letter does not match on its Persona_Screen, THEN THE persona page SHALL say that the seal check failed and SHALL NOT present the letter's contents as verified, as it does today.
11. WHILE the current UTC time is at or after the Opening_Date, THE persona pages for `us-maya`, `eu-tomas` and `us-priya` SHALL open straight on the first question, with no countdown and no still-sealed state, as they do today.

### Requirement 12: Tests read persona dates, and a guard keeps it that way

**User Story:** As the owner, I want the tests to read persona dates from the Persona_List, so that moving a date never means editing forty test files.

#### Acceptance Criteria

1. THE test files under `src/`, `tools/` and `scripts/` that assert a Persona's `written_as_of`, its `opens_at`, a month built from one of them, or a string built from one of them (for example "Opens {date}", "written as of {date}", "You lived through {month} too") SHALL read the value from the Persona_List through `src/lib/personas`, format it with the formatter in `src/components/ui/letter-date.ts` that the UI uses for that string, and contain no Persona_Dates literal in any Date_Form.
2. WHERE a test uses an Old_Persona_Date as an arbitrary fixture that does not describe a Persona, THE design SHALL list the test file and the reason it keeps the literal, and the literal SHALL NOT equal or contain any Date_Form of a current Persona_Dates value.
3. THE design SHALL list each of the 63 files of the code facts with exactly one action taken: reads the Persona_List, keeps an unrelated fixture date (with the reason), or comment updated. A comment marked "comment updated" (including those in `src/components/ui/letter-date.ts` and `src/lib/figures/at-opening.ts`) SHALL name the date by its Persona_List field (`written_as_of` or `opens_at`) and contain no Old_Persona_Date and no Date_Form of a current Persona_Dates value.
4. WHEN the existing test suite runs, THE Date_Guard SHALL read the Persona_Dates of every Persona from the Persona_List, build the five Date_Forms of each distinct Persona_Dates value (ten in all for the Written_Date and the Opening_Date of this spec), and scan every text file under `src/`, `tools/`, `scripts/`, `.github/` and `content/`, plus `README.md` and `docs/video-script.md`. A file counts as text unless it contains a NUL byte. Matching SHALL be a case-sensitive exact substring match on each line.
5. IF a Date_Form of a current Persona_Dates value appears in a scanned file other than the Persona_List, the three letter files (`us-maya.txt`, `eu-tomas.txt`, `us-priya.txt`) and the three copy-test records (`us-copy-test.md`, `eu-copy-test.md`, `us-priya-copy-test.md`), THEN THE Date_Guard SHALL fail the test run and report every occurrence with its file path, its 1-based line number and the Date_Form that matched, all in one run. The exempt files SHALL be listed by path in the Date_Guard test. Any further exemption (for example `tools/qa/layout-gate-baseline.json`, whose GO1 rows would otherwise hold "Opens 17 November 2026") SHALL be named in the design with its reason, or the file SHALL be changed so that it no longer holds the literal.
6. THE Date_Guard SHALL pass on the checkout after this spec. A commit message body SHALL record two runs: one where the Date_Guard fails after a Date_Form of the Written_Date is planted in a non-exempt file under `src/`, and names that file, line and Date_Form; and one where it passes after the plant is removed.
7. THE Date_Guard SHALL skip `node_modules`, `.next`, `dist`, `.git`, `.kiro/specs/` and `docs/design/` at any depth of the scanned roots, and SHALL list those exclusions by name in the test. The Date_Guard test file itself SHALL contain no Persona_Dates literal in any Date_Form, so it passes its own scan without an exemption.
8. IF the value of a `period` or `retrieved_at` field in the Figure_File equals, or contains, a Date_Form of a Persona_Dates value, THEN THE Date_Guard SHALL exempt only that field's value and still fail on the same Date_Form anywhere else in the Figure_File. THE design SHALL name each exempted field occurrence by series and period.
9. IF the Persona_List cannot be read or parsed, or it yields zero Persona_Dates values, THEN THE Date_Guard SHALL fail with an error that names the Persona_List and does not pass with zero Date_Forms checked.

### Requirement 13: What depends on the old dates

**User Story:** As the owner, I want every check, baseline and document that names the old dates updated, so that nothing still describes May 2024.

#### Acceptance Criteria

Old_Persona_Date and Old_Letter_Id are defined in the Glossary.

1. WHEN the journey check (`tools/qa/journey-check.mjs`) runs against production after the resealed Persona letters are deployed, THE journey check SHALL report J10 as passed: for each of the three Personas, the production `envelopeHash` equals the `envelope_hash` in the Persona_List. It SHALL also report J2 as passed: the walks of `/demo/personas/us-maya` and `/demo/personas/eu-tomas` reach the final step with no step failing.
2. THE files `tools/qa/journey-check.mjs` and `.github/workflows/journey-check.yml` SHALL contain no Old_Persona_Date and no Old_Letter_Id. Any Persona date, letter id or envelope hash the journey check compares SHALL be read from the Persona_List at run time.
3. IF J2 or J10 fails on production after the reseal, THEN the PR or issue that ships the reseal SHALL record the failing check, the Persona key and the value expected next to the value found, and THE spec SHALL NOT count as done until a later run passes both checks.
4. WHEN the layout gate baseline (`tools/qa/layout-gate-baseline.json`) is regenerated against a build with the new Persona_Dates, THE baseline SHALL contain no Old_Persona_Date, and each GO1 row that held "Opens 5 November 2024" or "Opens 9 June 2024" SHALL hold "Opens 17 November 2026". The PR description SHALL list every row added, removed or changed. Any row that is added or removed, or changed for a reason other than different date text, price text, letter text or Sample_Candidate text, SHALL be listed as a finding with its row id.
5. WHEN the layout check runs with `SAMPLE_SEED = 1`, THE pinned sample on each fuel question SHALL be one of the four Sample_Candidates for that metric in the new `samples.json`. Every test or baseline that names the pinned value SHALL read it from `samples.json` and SHALL contain no literal sample value.
6. THE `README.md` SHALL contain no Old_Persona_Date and no price quoted from a pre-reseal Persona letter. Each README image that shows a Persona date, price, letter text or figure, including `docs/readme-hero2x.png` if it shows any of these, SHALL either be retaken on the resealed letters or have a caption directly under it saying that the picture shows the earlier persona letters.
7. THE `docs/video-script.md` shot list SHALL be checked for every Persona date, month, season, price and quoted letter line, and each one found SHALL be changed to match the resealed letters and the Persona_Figures in `design.md`. The commit message body SHALL list each item found and its new text, or say that none was found.
8. THE comments in `src/components/ui/letter-date.ts` and `src/lib/figures/at-opening.ts` that use a Persona date as an example (including the "Tuesday, 17 November 2026" example on `formatWeekdayDate`) SHALL use an example date that is neither an Old_Persona_Date nor a Date_Form of a current Persona_Dates value, so the Date_Guard of Requirement 12 passes on both files without an exception for them.

### Requirement 14: Steering names no fixed window

**User Story:** As the owner, I want the steering docs to describe the persona dates as they now are, so that the next agent does not restore the old windows.

#### Acceptance Criteria

1. THE `.kiro/steering/product.md` Demo 1 section SHALL replace the sentence that introduces the fixed windows ("One or two personas per region, chosen from these fixed windows (the 12 months up to and including the date)") and its three bullets (US up to 5 November 2024, EU up to 9 June 2024, Sweden up to 11 September 2022) with wording the owner approves on review. This spec proposes **(proposed)**: "Each persona letter is written as of one date and opens on one date, both set in `content/personas/personas.json`. Today every persona is written as of a November Sunday and opens two years later."
2. THE `.kiro/steering/product.md` Demo 1 section SHALL keep its sentences "Opening dates are shown as plain dates, with no event name." and "A persona letter's "now" figures are the official records for the week of its opening date." unchanged.
3. THE `.kiro/steering/neutrality.md` "Election dates" section SHALL no longer say that election dates set the demo persona windows, in either its heading ("demo windows now") or its first bullet ("In the MVP, election dates only set the demo persona windows").
4. THE `.kiro/steering/neutrality.md` SHALL keep the rule that a persona opening date shows no event name, both in the "Revenant does not" list ("Show an event name next to a persona opening date") and in the rewritten "Election dates" section, and SHALL keep the rules on suggested opening dates after the MVP unchanged.
5. WHEN the change to `.kiro/steering/structure.md` is prepared, THE implementer SHALL read the code under `src/lib/events/` and record in the commit message body whether that code is used to set any Persona_Dates.
6. IF no code under `src/lib/events/` sets any Persona_Dates, THEN THE `.kiro/steering/structure.md` description of `lib/events/` ("Election dates with provenance for the demo windows") SHALL be changed to describe what the code does without naming the demo windows; otherwise that description SHALL stay unchanged.
7. WHEN the steering changes are merged, no file under `.kiro/steering/` SHALL contain any of the strings "5 November 2024", "9 June 2024", "11 September 2022", "demo window" or "persona window".
8. THE steering changes SHALL go in the same PR as the Persona_List change to the Written_Date and Opening_Date that they describe, and that PR SHALL record the owner's approval of the criterion 1 wording before it is merged.

### Requirement 15: Nothing else changes

**User Story:** As the owner, I want this to be a date and copy move only, so that no sealed rule or flow changes with it.

#### Acceptance Criteria

1. THE PR SHALL change no file under `src/lib/crypto/`, `src/lib/seal-format/`, `src/app/api/`, `drizzle/` or `deploy/helm/revenant/`, compared with the PR's base commit, and THE Helm chart `version` SHALL stay as it is at the base commit.
2. THE PR SHALL change no file under `src/lib/sources/` except the Prefetch_Script modules (`prefetch.ts`, `refresh.ts`) and their tests, and only for the gap and coverage checks of Requirement 2.2 and 2.3. THE data source adapters SHALL fetch the same series from the same source URLs as at the base commit.
3. THE PR SHALL change no line of `src/lib/figures/then-now.ts`. In `src/lib/figures/at-opening.ts`, the PR SHALL change only the comment lines named in Requirement 13.8. For every input, `thenAndNow` and `figureAtOpening` SHALL return the same figure as at the base commit.
4. WHEN the Sealing_Script reseals a Persona, THE Sealing_Script SHALL seal it with the same `format_version` as that Persona's letter at the base commit. THE PR SHALL add no `format_version` and SHALL change the meaning of none.
5. THE persona pages SHALL keep the same slugs (`us-maya`, `eu-tomas`, `us-priya`), the same steps in the same order, and the same step names as at the base commit. Between the base commit and the PR, a Persona_Screen SHALL differ only in dates, figures, Persona_Texts and the string of Requirement 10.5.
6. THE PR SHALL raise no value in `scripts/check-js-budget.mjs`, and the JS budget check SHALL pass on the PR's head commit.
7. WHEN the PR's head commit is ready for merge, `scripts/check.sh` SHALL exit with code 0 on that commit.
8. THE PR SHALL leave `package.json`, `package-lock.json` and `.env.example` unchanged, and SHALL add no route under `src/app/`.
9. IF a task finds that a change is needed in a path or rule that criteria 1 to 8 keep unchanged, THEN THE task SHALL stop before making that change and record in `design.md` the path, the change it needs and the reason. The change SHALL wait for the owner's recorded approval.

### Requirement 16: Verification

**User Story:** As the owner, I want to walk the three persona pages after the reseal, so that I see the new dates and figures the way a judge will.

#### Acceptance Criteria

1. WHEN the Live_Walk runs with `WALK=1` against a local production build that serves the resealed letters, THE Live_Walk SHALL walk each of `/demo/personas/us-maya`, `/demo/personas/eu-tomas` and `/demo/personas/us-priya` through every step it shows, in order, from Remember to its last step. It SHALL do this at 1440 × 900 and again at 390 × 844, which makes six walks in all.
2. WHEN the Live_Walk reaches a step that shows a Persona date, THE Live_Walk SHALL assert that each date on that step equals the string that the date formatters in `src/components/ui/letter-date.ts` produce from the Persona_List values. The dates are the written-as-of date in `letterDisclosure` (from the Written_Date), the month in `REVEAL_COPY.memoryLine` (from the Written_Date, Fuel_Personas only), and the date in `CEREMONY_COPY.envelopeOpens` (from the date part of the Opening_Date). The assertion fails if any of these strings is missing from a step where the persona page shows it today.
3. WHEN the Live_Walk reaches a step that shows `REVEAL_COPY.sealedForThisDemo`, THE Live_Walk SHALL assert two things: the line uses the wording approved under Requirement 10.5, and its date equals the `sealedAt` in the header of the letter that page served.
4. WHEN the Live_Walk reaches the Receipts step of a Fuel_Persona, THE walk report SHALL list four entries for each of that persona's two metrics: the then value as shown, the then period, the at-opening value as shown and the at-opening period. The report SHALL also list the date in each `labelHistoricalRecord` line. Each value and period SHALL equal the "value as shown" and `period` columns of the design's Persona_Figures table (Requirement 4.2) for that persona, metric and side. Each retrieved date SHALL equal the date part of that row's `retrieved_at`. No value in the report SHALL be typed in by hand. Every value SHALL be read from the rendered page and from the design table.
5. IF any Persona_Screen step at either viewport shows an Old_Persona_Date, or shows letter text or a Price_Line that contains a price string from the pre-reseal letters (`$3.64`, `$3.89`, `€1.79`, `€1.65`), THEN THE Live_Walk SHALL fail that step, and THE walk report SHALL record the route, viewport, step and the text it found. The price strings are checked in the letter text and Price_Lines only, since a new figure shown outside the letter may round to the same value.
6. IF a check in 16.2, 16.3, 16.4 or 16.5 fails at any route or viewport, THEN THE verification task SHALL NOT be marked done. Its commit message body SHALL name each failing check by criterion number, with its route, viewport and step, the value it expected and the value it found.
7. IF the Live_Walk is skipped, because `WALK` is unset or not exactly `1`, or because one of the six walks in 16.1 does not reach its last step, THEN THE verification task SHALL NOT count that run as a pass. The commit message body SHALL say which walks did not run or did not finish.
8. WHEN a task changes behaviour, THE task SHALL update or retire each test that the change outdates in the same commit, and SHALL name each such test and its reason in the commit message body. A test is outdated when it asserts an old Persona_Dates value, an Old_Letter_Id or old `envelope_hash`, an old Sample_Candidate, an old price in a Price_Line, or the old `sealedForThisDemo` wording.
9. WHEN the verification task is marked done, THE task SHALL record in its commit message body that the full test suite and the Live_Walk both passed on the same commit, and SHALL name that commit.

## Open questions

1. **Six or eight figures.** The request says "the six new figures". Maya and Tomás track two series each, and each series has a then and an at-opening figure: eight figures. This spec covers all eight. Confirm, or say which six were meant.
2. **Which retrieval date the label shows.** The Prefetch_Script is append-only. The Then_Figures (week of 11 November 2024, if no later week is on or before 17 November) are already in the Figure_File with `retrieved_at` 1 November 2026, and a refetch keeps that date. Only the newly added weeks, including each Opening_Figure, get the new retrieval date. Requirement 2.7 has each label show its own figure's `retrieved_at`. If the owner wants the Then_Figures to show the new date too, the Figure_File would have to be rebuilt from scratch, which is a change to the append-only rule. Default: each figure shows its own `retrieved_at`.
3. **What a missing week means.** Requirement 2.2 fails on any Weekly_Gap in a Persona_Series, across the whole file. The Weekly Oil Bulletin is sometimes not published in a holiday week. If a gap appears between 26 October 2026 and the opening week, this rule blocks the move until the source fills it. The alternative is to fail only when the Then_Figure or Opening_Figure week is missing. Default: fail on any gap, as asked.
4. **"Sealed for this demo on".** Requirement 10.5 proposes "Sealed later, for this demo, on {sealedAt}." Confirm, or give other wording.
5. **"Opens {date}" for a past date.** The envelope reads "Opens 17 November 2026" after that date, as it read "Opens 5 November 2024" before. This spec keeps it. Say if it should change.
6. **Steering windows.** Requirement 14.1 proposes new Demo 1 wording and drops the Sweden window, since there is no Swedish persona. Confirm, or keep a window for a future Swedish persona.
7. **Public events in the banned list.** Requirement 8.1 adds public holidays ("thanksgiving", "holiday") as well as election terms, since the request says "or any public event". "holiday" may be too broad for everyday letters. Confirm the list in the design.
8. **Who runs the reseal.** The Sealing_Script runs in the production init container when `demo.sealPersonas` is set. The owner deploys through Fleet. Requirement 11.5 needs the production hash before it is committed; the design proposes the order of deploy, seal and hash commit, and J10 fails between the deploy and the hash commit.
9. **Does sealing wait for Jacob Morgan's pass?** The owner's request asks to run the copy tests, and the Approval_Gate (Requirement 4.9) is the sealing gate. The copy-test reviewer result stays pending until Jacob Morgan records it. By default, sealing does not wait for it. If the owner records in `design.md` that sealing should wait, Requirement 6.11 holds the Sealing_Script until Jacob Morgan has recorded a pass for every Persona_Text and the sealed-for-demo line. Confirm the default, or say that sealing waits.
