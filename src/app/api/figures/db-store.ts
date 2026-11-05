// The Postgres read store for GET /api/figures in database mode (spec 08,
// design "The Figures_API" and "Data Models": the latest-figure and
// Last_Success_Time queries). Server-only: it reaches the database through
// `getSql`, and no browser code imports it.
//
// Both queries take no user input, so there are no parameters to bind. The
// database connection string is never read here except through getSql, and
// errors are not caught here: respond.ts answers a neutral 500.

import type { Sql } from "postgres";

import { getSql } from "@/lib/db/client";

import type { FigureReadStore, StoredFigureRow } from "./db-response";

/** Reads from an open client. Separate from getSql so the SQL can be run on any client. */
export function createPostgresFigureReadStore(sql: Sql): FigureReadStore {
  return {
    async latestFigures(): Promise<readonly StoredFigureRow[]> {
      // The newest period wins, then the newest retrieved_at for that period
      // (a Revision_Row is served over the row it revised), then the newest id.
      const rows = await sql<StoredFigureRow[]>`
        SELECT DISTINCT ON (source, series_id, unit, region)
          metric_id, kind, value::text AS value, unit, region, period,
          source, series_id, source_url, retrieved_at
        FROM figures
        ORDER BY source, series_id, unit, region,
          period DESC, retrieved_at DESC, id DESC`;
      return rows;
    },

    async lastSuccessTimes(): Promise<ReadonlyMap<string, Date>> {
      // Last_Success_Time: only success outcomes count. A failed run row never
      // moves it (R20.18, R21.5).
      const rows = await sql<{ metric_id: string; at: Date }[]>`
        SELECT metric_id, max(run_started_at) AS at
        FROM figure_fetch_runs
        WHERE outcome <> 'failed'
        GROUP BY metric_id`;
      return new Map(rows.map((row) => [row.metric_id, row.at]));
    },
  };
}

/** The read store on the app's shared client. Throws if DATABASE_URL is unset. */
export function getFigureReadStore(): FigureReadStore {
  return createPostgresFigureReadStore(getSql());
}
