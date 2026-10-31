// Figure-file loader for the figures model (spec 02-demo-figures).
//
// loadFigureFile validates a figure file (fixture now, real data later) against
// the eight rules in design.md, in that exact order, throwing FigureDataError
// on the first failure. On success it groups figures by series (catalogue order
// first, then file order), sorts each group by period end oldest-first, keeps
// every value string verbatim, never applies a display rescale, includes series
// with no figures, and deep-freezes the whole result so nothing downstream can
// mutate sealed-style data.
//
// Pure module: imports only zod, the two sealed-letter schemas, and sibling
// figures modules. Nothing from src/lib/crypto, src/lib/db or Node built-ins,
// no network. Safe in the browser and on the server.

import { z } from "zod";

import { figureV1Schema, metricDefinitionV1Schema } from "@/lib/seal-format";
import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";

import type {
  CatalogueSeries,
  DisplayRescale,
  LoadedFigures,
  LoadedSeries,
  PeriodType,
} from "./types";
import { isRealDate, isRealMonth, periodEnd } from "./periods";
import { isFixtureFigure, isFixtureMetric } from "./fixture";

// The rules a figure file can break, in loader order.
export type FigureDataRule =
  | "shape"
  | "duplicate_metric_id"
  | "fixture_flag"
  | "unknown_metric"
  | "metric_mismatch"
  | "bad_period"
  | "duplicate_period";

/**
 * Thrown by loadFigureFile on the first failed rule. `rule` names the rule and
 * `path` points at the offending value (for example `figures.3.period`). The
 * message is fixed text naming both, so callers can rely on `rule`/`path`
 * rather than parsing prose.
 */
export class FigureDataError extends Error {
  readonly rule: FigureDataRule;
  readonly path: string;

  constructor(rule: FigureDataRule, path: string) {
    super(`figure data invalid: ${rule} at ${path}`);
    this.name = "FigureDataError";
    this.rule = rule;
    this.path = path;
  }
}

// --- Shape schema ------------------------------------------------------------

// A display rescale: an exact power-of-ten divisor and the unit after rescale.
const displayRescaleSchema = z.strictObject({
  divisor: z.union([
    z.literal(10),
    z.literal(100),
    z.literal(1000),
    z.literal(10000),
    z.literal(100000),
    z.literal(1000000),
  ]),
  unit: z.string().min(1).max(200),
});

const periodTypeSchema = z.union([z.literal("weekly"), z.literal("monthly")]);

// One catalogue/file series: a metric definition (validated with the sealed
// schema, never a second copy), its period type and an optional rescale.
const catalogueSeriesSchema = z.strictObject({
  metric: metricDefinitionV1Schema,
  period_type: periodTypeSchema,
  display_rescale: displayRescaleSchema.optional(),
});

// The whole figure file. Strict so an unknown key is rejected. Figures use the
// sealed figure schema, so there is no second schema for those fields.
const figureFileSchema = z.strictObject({
  fixture: z.boolean(),
  note: z.string().min(1).max(500).optional(),
  series: z.array(catalogueSeriesSchema),
  figures: z.array(figureV1Schema),
});

// --- Helpers -----------------------------------------------------------------

// Build a "figures.3.period"-style path from a Zod error, taking the first
// issue and falling back to the file root when its path is empty.
function zodPath(error: z.ZodError): string {
  const first = error.issues[0];
  if (first === undefined || first.path.length === 0) return "(root)";
  return first.path.map((seg) => String(seg)).join(".");
}

type ParsedSeries = z.infer<typeof catalogueSeriesSchema>;
type ParsedFile = z.infer<typeof figureFileSchema>;

// True when a period string matches its series' period type and names a real
// date (weekly) or real month (monthly).
function periodOk(period: string, type: PeriodType): boolean {
  return type === "weekly" ? isRealDate(period) : isRealMonth(period);
}

// Deep-freeze a value (object, array or primitive) and everything it reaches.
// Used once on the finished LoadedFigures so no part of it can be mutated.
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

// --- Loader ------------------------------------------------------------------

/**
 * Validate a figure file against the catalogue and return a frozen
 * LoadedFigures, or throw FigureDataError on the first failed rule.
 *
 * Checks run in design.md order:
 *   1 shape, 2 catalogue validity, 3 unique metric IDs, 4 fixture flag,
 *   5 known series, 6 metric match, 7 period format, 8 duplicate period.
 */
export function loadFigureFile(
  json: unknown,
  catalogue: readonly CatalogueSeries[],
): LoadedFigures {
  // 1. File shape.
  const fileParse = figureFileSchema.safeParse(json);
  if (!fileParse.success) {
    throw new FigureDataError("shape", zodPath(fileParse.error));
  }
  const file: ParsedFile = fileParse.data;

  // 2. Catalogue validity: every catalogue entry passes the same series check.
  for (let i = 0; i < catalogue.length; i++) {
    const catParse = catalogueSeriesSchema.safeParse(catalogue[i]);
    if (!catParse.success) {
      throw new FigureDataError("shape", `catalogue.${i}.${zodPath(catParse.error)}`);
    }
  }

  // Collect every series, catalogue first then file, so grouping and the
  // "resolves to exactly one series" check both see catalogue order first.
  type SeriesRef = {
    series: CatalogueSeries | ParsedSeries;
    origin: "catalogue" | "file";
    index: number;
  };
  const allSeries: SeriesRef[] = [];
  for (let i = 0; i < catalogue.length; i++) {
    allSeries.push({ series: catalogue[i], origin: "catalogue", index: i });
  }
  for (let i = 0; i < file.series.length; i++) {
    allSeries.push({ series: file.series[i], origin: "file", index: i });
  }

  // 3. Unique metric IDs across the catalogue and the file together.
  const byMetricId = new Map<string, SeriesRef>();
  for (const ref of allSeries) {
    const id = ref.series.metric.id;
    if (byMetricId.has(id)) {
      const path =
        ref.origin === "catalogue"
          ? `catalogue.${ref.index}.metric.id`
          : `series.${ref.index}.metric.id`;
      throw new FigureDataError("duplicate_metric_id", path);
    }
    byMetricId.set(id, ref);
  }

  // 4. Fixture flag agreement.
  //    - catalogue never fixture;
  //    - fixture:true  => every file metric & figure is FIXTURE-prefixed;
  //    - fixture:false => no file metric or figure is FIXTURE-prefixed.
  for (let i = 0; i < catalogue.length; i++) {
    if (isFixtureMetric(catalogue[i].metric)) {
      throw new FigureDataError("fixture_flag", `catalogue.${i}.metric`);
    }
  }
  if (file.fixture) {
    for (let i = 0; i < file.series.length; i++) {
      if (!isFixtureMetric(file.series[i].metric)) {
        throw new FigureDataError("fixture_flag", `series.${i}.metric`);
      }
    }
    for (let i = 0; i < file.figures.length; i++) {
      if (!isFixtureFigure(file.figures[i])) {
        throw new FigureDataError("fixture_flag", `figures.${i}`);
      }
    }
  } else {
    for (let i = 0; i < file.series.length; i++) {
      if (isFixtureMetric(file.series[i].metric)) {
        throw new FigureDataError("fixture_flag", `series.${i}.metric`);
      }
    }
    for (let i = 0; i < file.figures.length; i++) {
      if (isFixtureFigure(file.figures[i])) {
        throw new FigureDataError("fixture_flag", `figures.${i}`);
      }
    }
  }

  // 5. Each figure's metric_id resolves to exactly one series.
  // 6. Figure fields equal the metric's; kind is "official".
  // 7. Period format matches the series' period_type and is a real date/month.
  for (let i = 0; i < file.figures.length; i++) {
    const fig = file.figures[i];
    const ref = byMetricId.get(fig.metric_id);
    if (ref === undefined) {
      throw new FigureDataError("unknown_metric", `figures.${i}.metric_id`);
    }

    const metric: MetricDefinitionV1 = ref.series.metric;
    if (
      fig.kind !== "official" ||
      fig.unit !== metric.unit ||
      fig.region !== metric.region ||
      fig.source !== metric.source ||
      fig.series_id !== metric.series_id
    ) {
      throw new FigureDataError("metric_mismatch", `figures.${i}`);
    }

    if (!periodOk(fig.period, ref.series.period_type)) {
      throw new FigureDataError("bad_period", `figures.${i}.period`);
    }
  }

  // 8. No duplicate period within a series.
  const seenPeriods = new Map<string, Set<string>>();
  for (let i = 0; i < file.figures.length; i++) {
    const fig = file.figures[i];
    let seen = seenPeriods.get(fig.metric_id);
    if (seen === undefined) {
      seen = new Set<string>();
      seenPeriods.set(fig.metric_id, seen);
    }
    if (seen.has(fig.period)) {
      throw new FigureDataError("duplicate_period", `figures.${i}.period`);
    }
    seen.add(fig.period);
  }

  // Group figures by series in catalogue-then-file order, sort each group by
  // period end ascending (file order never matters), and build LoadedSeries.
  const seriesMap = new Map<string, LoadedSeries>();
  for (const ref of allSeries) {
    const metricId = ref.series.metric.id;
    const type = ref.series.period_type;

    const group: FigureV1[] = [];
    for (const fig of file.figures) {
      if (fig.metric_id === metricId) group.push(fig);
    }
    group.sort((a, b) => {
      const ea = periodEnd(a.period, type);
      const eb = periodEnd(b.period, type);
      return ea < eb ? -1 : ea > eb ? 1 : 0;
    });

    const loaded: LoadedSeries = {
      metric: ref.series.metric,
      period_type: type,
      ...(ref.series.display_rescale !== undefined
        ? { display_rescale: ref.series.display_rescale as DisplayRescale }
        : {}),
      figures: group,
    };
    seriesMap.set(metricId, loaded);
  }

  const result: LoadedFigures = {
    fixture: file.fixture,
    series: seriesMap,
  };

  // Deep-freeze everything reachable: the result, the series map's values, each
  // metric, display_rescale, the figures arrays and their elements. The Map
  // itself is frozen too, so entries cannot be added or removed.
  deepFreeze(result);
  Object.freeze(seriesMap);
  for (const loaded of seriesMap.values()) {
    deepFreeze(loaded);
  }

  return result;
}
