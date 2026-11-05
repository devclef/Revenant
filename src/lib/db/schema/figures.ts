import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Drizzle schema for the figure tables: `figures` (every fetched value, with
 * provenance) and `figure_fetch_runs` (one row per series per Fetch_Job run).
 *
 * This file defines table shapes, column types, CHECK constraints, unique
 * constraints and indexes only. The immutability triggers (`BEFORE UPDATE OR
 * DELETE` and `BEFORE TRUNCATE` that call `revenant_forbid_change()`) are not
 * expressible in drizzle-kit, so they are appended by hand to the generated
 * migration `drizzle/0002_figures.sql` after the generated DDL.
 *
 * `value` is `numeric` with no precision limit, so a published value is stored
 * and read back at full precision. Rounding happens only at display time.
 */

/**
 * A figure with full provenance. A period may hold several rows: the first
 * value and its Revision_Rows, which differ by `retrieved_at`. Two rows never
 * share the same `retrieved_at` for one series and period.
 */
export const figures = pgTable(
  "figures",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    metricId: text("metric_id").notNull(),
    kind: text("kind").notNull().default("official"),
    value: numeric("value").notNull(),
    unit: text("unit").notNull(),
    region: text("region").notNull(),
    period: text("period").notNull(),
    source: text("source").notNull(),
    seriesId: text("series_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    check("figures_kind", sql`${table.kind} = 'official'`),
    check(
      "figures_period_format",
      sql`${table.period} ~ '^\\d{4}-\\d{2}(-\\d{2})?$'`,
    ),
    check("figures_source_url_https", sql`${table.sourceUrl} ~ '^https://'`),
    unique("figures_series_period_retrieved_unique").on(
      table.source,
      table.seriesId,
      table.unit,
      table.region,
      table.period,
      table.retrievedAt,
    ),
    index("figures_series_latest_idx").on(
      table.source,
      table.seriesId,
      table.unit,
      table.region,
      table.period.desc(),
      table.retrievedAt.desc(),
      table.id.desc(),
    ),
  ],
);

/**
 * Append-only record of one series in one Fetch_Job run. `run_started_at` is
 * the run's UTC start. A success outcome (`stored` or `no_new_period`) makes
 * that instant the series' Last_Success_Time; a `failed` row does not.
 */
export const figureFetchRuns = pgTable(
  "figure_fetch_runs",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    runStartedAt: timestamp("run_started_at", { withTimezone: true }).notNull(),
    metricId: text("metric_id").notNull(),
    outcome: text("outcome").notNull(),
    added: integer("added").notNull(),
    revisions: integer("revisions").notNull(),
    reason: text("reason").notNull(),
  },
  (table) => [
    check("figure_fetch_runs_added_nonneg", sql`${table.added} >= 0`),
    check(
      "figure_fetch_runs_revisions_range",
      sql`${table.revisions} >= 0 AND ${table.revisions} <= ${table.added}`,
    ),
    check(
      "figure_fetch_runs_reason_len",
      sql`char_length(${table.reason}) <= 200`,
    ),
    check(
      "figure_fetch_runs_outcome",
      sql`${table.outcome} IN ('stored', 'no_new_period', 'failed')`,
    ),
    unique("figure_fetch_runs_once").on(table.runStartedAt, table.metricId),
    index("figure_fetch_runs_success_idx")
      .on(table.metricId, table.runStartedAt.desc())
      .where(sql`${table.outcome} <> 'failed'`),
  ],
);
