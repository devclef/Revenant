// Public barrel for the figures model (spec 02-demo-figures).
//
// Re-exports the periods, fixture, catalogue and loader pieces of this task so
// callers import from "@/lib/figures" rather than reaching into sibling files.
// Then-now comparison and the demo file live in Task 2 and are NOT exported
// here.
//
// Pure module: like everything it re-exports, it imports nothing from
// src/lib/crypto, src/lib/db or Node built-ins, so it is safe in the browser
// and on the server.

export type {
  PeriodType,
  DisplayRescale,
  CatalogueSeries,
  FigureFile,
  LoadedSeries,
  LoadedFigures,
  Missing,
  Found,
  ThenNow,
} from "./types";

export { isRealDate, isRealMonth, periodEnd } from "./periods";

export { FIXTURE_PREFIX, isFixtureFigure, isFixtureMetric } from "./fixture";

export { CATALOGUE } from "./catalogue";

export { FigureDataError, loadFigureFile } from "./load";
export type { FigureDataRule } from "./load";
