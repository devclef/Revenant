# Requirements Document

Spec: 02 Demo figures

## Introduction

This spec defines the data model for fuel figures and a clearly fake fixture for one example persona, so spec 03 (persona demo) can be built before real data is fetched. It delivers a catalogue of real metric definitions for petrol and diesel retail prices in the US (USD), the EU (EUR, EU weighted average) and Sweden (SEK), a fixture file with fake figures for the US persona window (2023-11 to election day, 5 November 2024) plus a few later "now" points, and a pure helper in `src/lib/figures` that picks the "then" and "now" figure for a series. Metric definitions and figures drop into the spec 02 sealed payload version 1 unchanged. Owner role: data-dev. Follows `data-integrity.md`, `neutrality.md` and `tech.md`.

Depends on spec 02-sealed-letters task 1 (`src/lib/seal-format`) being merged, since this spec reuses its schemas.

## Out of scope

Real fetching, source adapters, API keys, the fetch CronJob, the real-data file itself, groceries, rent, wages, fixture figures for the EU and Sweden, persona letter text, recall question wording, any UI, database tables and API routes.

## Requirements

### R1. Reuse the sealed payload schemas

**User story:** As the spec 03 developer, I want catalogue and fixture entries to fit the sealed payload as they are, so I can seal them without mapping or copying fields.

1. THE SYSTEM SHALL validate every metric definition and every figure with the Zod schemas and types exported from `src/lib/seal-format` (spec 02-sealed-letters R1.5 to R1.8), and SHALL define no second schema for the fields those schemas cover.
2. THE SYSTEM SHALL validate each figure with `figureV1Schema` and each metric definition with `metricDefinitionV1Schema`, and SHALL use their types `FigureV1` and `MetricDefinitionV1`, all imported from `src/lib/seal-format`.
3. EVERY figure SHALL have `kind` `official`, a `value` that is an exact decimal string, and a `source_url` that is an absolute `https` URL.
4. EVERY figure's `unit`, `region`, `source` and `series_id` SHALL equal the same fields of the metric definition its `metric_id` references. IF any of them differs, THEN THE loader SHALL reject the data.
5. FOR ALL figures and metric definitions in the catalogue and fixture, a payload built from any subset of fixture figures together with their metric definitions SHALL pass `payloadV1Schema`, and parsing that payload SHALL return figures deeply equal to the inputs (round trip).

### R2. Series catalogue

**User story:** As a reader of a sealed letter, I want each fuel series to name its real publisher and identifier, so the "now" figure can be found later without guessing.

1. THE catalogue SHALL hold one real metric definition for each of these six series: petrol and diesel retail price for the US (EIA weekly U.S. average, USD), the EU (European Commission Weekly Oil Bulletin, EU weighted average, EUR) and Sweden (Weekly Oil Bulletin, SEK).
2. EACH real metric definition SHALL carry the publisher's real source name. WHERE the publisher is the U.S. EIA, THE `series_id` SHALL be EIA's real series ID. WHERE the source is the Weekly Oil Bulletin, which publishes no series IDs, THE `series_id` SHALL be a plain description of where the figure sits in the published file (file name, sheet, column and country), and SHALL NOT be written to look like an official identifier. THE design SHALL record, for each series, where the ID or file location was confirmed (URL and date checked).
3. EACH metric ID SHALL be unique across the catalogue and the fixture together.
4. EACH catalogue series SHALL also carry these catalogue-only fields, which are not part of the sealed payload: a period type of `weekly` or `monthly`, and an optional display rescale.
5. WHERE a series has a display rescale, THE rescale SHALL be an exact power-of-ten divisor with the unit it produces (for example, per 1,000 litres to per litre), and THE stored `value` SHALL stay exactly as published.
6. THE catalogue-only fields SHALL be removable without loss, so a metric definition with those fields stripped passes the sealed payload metric schema.
7. THE catalogue order of series SHALL be fixed in the source file and SHALL NOT depend on any figure value or on the direction of any change.
8. THE display names SHALL be plain descriptions of what is measured (for example "Regular petrol, retail price"), with no words that describe a change or judge a value.

### R3. Period formats

**User story:** As the spec 03 developer, I want one fixed period format per period type, so comparing a period with a date has one meaning.

1. WHERE a series has period type `monthly`, EACH of its figures SHALL have a `period` in the form `YYYY-MM` naming a real month.
2. WHERE a series has period type `weekly`, EACH of its figures SHALL have a `period` in the form `YYYY-MM-DD` naming a real calendar date, equal to the date the publisher uses for that week.
3. IF a figure's `period` does not match its series' period type form, or names a date or month that does not exist (for example `2024-02-30` or `2024-13`), THEN THE loader SHALL reject the data.
4. A figure's period end SHALL be the given date for `weekly` periods and the last calendar day of the month for `monthly` periods. "At or before a date" SHALL mean the period end is on or before that date.
5. WITHIN one series, no two figures SHALL share a `period`. IF two do, THEN THE loader SHALL reject the data. The order of figures in the file SHALL have no effect on any result.

### R4. Fixture data

**User story:** As the owner, I want mock figures that no one could mistake for real ones, so spec 03 can be built now without breaking `data-integrity.md`.

1. THE fixture SHALL live in its own JSON file under `src/lib/figures/`, separate from the catalogue, with a top-level `"fixture": true`.
2. THE fixture SHALL hold fixture metric definitions that mirror the US petrol and US diesel real definitions' unit and region, with a display name equal to the real display name followed by ` (fixture)`, `source` and `series_id` each starting with `FIXTURE`, and fixture figures that reference only those fixture definitions.
3. EVERY fixture figure SHALL have `source` and `series_id` starting with `FIXTURE`, and a `source_url` pointing to the real publisher's page for that series.
4. EVERY fixture figure `value` SHALL be round, meaning the value matches `^[0-9]+\.00$`.
5. EVERY fixture figure `retrieved_at` SHALL be `2000-01-01T00:00:00Z`.
6. FOR EACH of the two fixture series, THE fixture SHALL hold at least one figure with a period end from 2023-11-01 to 2024-11-05 and at least two figures with a period end after 2024-11-05.
7. THE fixture SHALL hold no figures for the EU or Sweden.
8. THE location of the real-data file SHALL be fixed in the design under `src/lib/figures/`, and THIS spec SHALL NOT create it. Real data SHALL be added later as that new file, and the fixture file SHALL NOT be edited into real data.

### R5. Fixture guard

**User story:** As a user or judge, I want fake figures never to be shown as real, even after they have been sealed into a persona letter.

1. THE SYSTEM SHALL provide pure functions `isFixtureFigure(figure)` and `isFixtureMetric(metric)` in `src/lib/figures`. Each SHALL return `true` when the object's `source` or `series_id` starts with `FIXTURE`, and `false` otherwise. They SHALL read only fields that are part of the sealed payload, so they give the same answer for a figure from the fixture file and for the same figure parsed from a decrypted payload.
2. THE `FIXTURE` prefix on `source` and `series_id` SHALL be the only rule that marks data as fixture data. THE loader SHALL add no separate marker. Spec 03 SHALL call `isFixtureFigure` on every figure from a decrypted payload and SHALL show a visible "fixture data" label next to each figure for which it returns `true`.
3. Fixture data MAY be loaded in any `NODE_ENV`, including `production` on the deployed demo site, as `data-integrity.md` allows while each figure carries the label.
4. IF a file has `"fixture": true` but any figure or metric definition does not have both `source` and `series_id` starting with `FIXTURE`, or a file without that flag has any figure or metric definition whose `source` or `series_id` starts with `FIXTURE`, THEN THE loader SHALL reject the file.
5. THE SYSTEM SHALL include tests that prove:
   - every figure and metric definition in the fixture file is detected by `isFixtureFigure` and `isFixtureMetric`;
   - every real metric definition in the catalogue is not detected;
   - a fixture figure placed in a payload that is serialised and parsed back with `payloadV1Schema` is still detected by `isFixtureFigure`;
   - both R5.4 mismatches are rejected.
6. IF this spec's code needs a file outside data-dev's paths (`src/lib/figures/**` and the others in `.github/agents.json`), THEN THE design SHALL flag the change for the owner and SHALL NOT make it.

### R6. Then and now helper

**User story:** As the spec 03 developer, I want one function that picks the "then" and "now" figure for a series, so the reveal shows real gaps instead of filled ones.

1. THE helper SHALL be a pure function in `src/lib/figures` that takes a metric ID, a calendar date in the form `YYYY-MM-DD`, and the loaded data, and returns a "then" result and a "now" result.
2. THE "then" result SHALL be the figure of that series with the latest period end at or before the given date.
3. THE "now" result SHALL be the figure of that series with the latest period end overall.
4. EVERY figure the helper returns SHALL be the same object that the loader read from the file, with no field changed, rounded, rescaled or added.
5. IF the metric ID matches no series, THEN THE helper SHALL return a missing result with reason `unknown_series` for both "then" and "now".
6. IF the series has no figures, THEN THE helper SHALL return a missing result with reason `no_figures` for both "then" and "now".
7. IF the series has figures but none at or before the given date, THEN THE helper SHALL return a missing "then" result with reason `none_at_or_before_date` and SHALL still return the "now" figure.
8. IF the given date is not a real calendar date in the form `YYYY-MM-DD`, THEN THE helper SHALL throw an error naming the date argument.
9. THE helper SHALL NOT interpolate, average, or take a figure from another series or region.

### R7. Tests

**User story:** As the owner, I want the data rules checked by tests, so a bad figure fails CI before it can be sealed.

1. THE SYSTEM SHALL include tests that run in `npm test` with no network and no database.
2. THE tests SHALL check that every figure passes the spec 02 figure schema, every metric definition passes the metric schema, and the payload in R1.5 passes `payloadV1Schema`.
3. THE tests SHALL check that every `metric_id` matches exactly one metric definition, metric IDs are unique (R2.3), and no series has two figures with the same period (R3.5).
4. THE tests SHALL check that each series has exactly one `unit`, one `region` and one `series_id` across all its figures, equal to its metric definition (R1.4).
5. THE tests SHALL check the fixture rules in R4.1 to R4.7.
6. FOR ALL generated series, dates and figure orders, a fast-check property test with at least 100 runs SHALL check that the helper returns only figures from the given series, never a "then" figure with a period end after the date, returns the same result for any order of figures, and reports the R6.5 to R6.7 reasons instead of a figure. Generated test figures SHALL use `FIXTURE` sources and round values.
7. THE tests SHALL check that the loader rejects data that breaks R1.4, R3.3 or R3.5, with one example per rule.
