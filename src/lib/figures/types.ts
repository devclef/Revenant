// Types for the figures model (spec 02-demo-figures).
//
// Types only: this module contains no runtime code. The figure and metric
// shapes reuse FigureV1 and MetricDefinitionV1 from the sealed-letter format,
// so there is no second schema for those fields (they are validated with
// figureV1Schema and metricDefinitionV1Schema at load time).
//
// This module imports nothing from src/lib/crypto, src/lib/db or Node
// built-ins, so it is pure and safe to use in the browser and on the server.

import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";

export type PeriodType = "weekly" | "monthly";

export interface DisplayRescale {
  divisor: 10 | 100 | 1000 | 10000 | 100000 | 1000000; // exact power of ten (R2.5)
  unit: string; // unit after rescale, e.g. "EUR per litre"
}

// Catalogue-only fields sit next to the metric, never inside it (R2.4, R2.6).
export interface CatalogueSeries {
  metric: MetricDefinitionV1;
  period_type: PeriodType;
  display_rescale?: DisplayRescale;
}

// JSON shape of a figure file.
export interface FigureFile {
  fixture: boolean;
  note?: string; // plain description of the file, 1–500 chars
  series: CatalogueSeries[]; // series defined by this file (fixture defines its own two)
  figures: FigureV1[]; // may reference series in this file or in the catalogue
}

export interface LoadedSeries {
  readonly metric: Readonly<MetricDefinitionV1>;
  readonly period_type: PeriodType;
  readonly display_rescale?: Readonly<DisplayRescale>;
  readonly figures: readonly Readonly<FigureV1>[]; // sorted by period end, oldest first
}

export interface LoadedFigures {
  // True when this set holds fixture data. A Merged_Set (see merge.ts) is fixture
  // when either input is fixture, so the flag means "may contain fixture figures"
  // (R9.3). Each figure still carries its own FIXTURE-prefixed source, so fixture
  // figures must be labelled one by one.
  readonly fixture: boolean;
  readonly series: ReadonlyMap<string, LoadedSeries>; // key: metric id; catalogue order first, then file order
}

export type Missing = {
  found: false;
  reason: "unknown_series" | "no_figures" | "none_at_or_before_date";
};
export type Found = { found: true; figure: Readonly<FigureV1> };
export interface ThenNow {
  then: Found | Missing;
  now: Found | Missing;
}
