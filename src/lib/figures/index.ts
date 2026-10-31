// Public barrel for the figures model (spec 02-demo-figures, 03-persona-demo).
//
// Re-exports the periods, fixture, catalogue and loader pieces, plus the exact
// decimal arithmetic, the then-vs-now change calculator, the display formatting
// and the locale/rescale helpers, so callers import from "@/lib/figures" rather
// than reaching into sibling files.
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

export {
  parseDecimal,
  toDecimalString,
  add,
  sub,
  isZero,
  ratioPercent,
} from "./decimal";
export type { Decimal, RatioPercent } from "./decimal";

export { computeChange, CHANGE_FORMULA_ID } from "./change";
export type { ChangeResult, NotComparableReason } from "./change";

export { formatChange, formatValue, formatPeriod } from "./format-change";
export type { ChangeDisplay } from "./format-change";

export { localeForRegion } from "./locale";

export { rescaleForDisplay } from "./rescale";
