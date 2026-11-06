// The Postgres FigureStore for the Fetch_Job (spec 08-judge-polish, task 16; design.md
// "The daily figure fetch" and "Data Models": insert if different, and the run
// rows). Used only by scripts/fetch-figures.ts. It is wired into the script entry
// and never into an HTTP route (R20.7).
//
// Every statement is parameterised: no value is interpolated into SQL (tech.md).
// The job itself never updates or deletes; the database triggers would refuse it.

import type postgres from "postgres";

type Sql = postgres.Sql;
type Tx = postgres.TransactionSql;

import type { FigureRow, FigureStore } from "@/lib/sources/fetch-job";
import type { FetchSession } from "@/lib/sources/fetch-gate";

/** Inserts one figure row with the eight provenance columns. The `kind` column defaults to official. */
function insertFigure(tx: Tx, row: FigureRow) {
  return tx`
    INSERT INTO figures
      (metric_id, kind, value, unit, region, period, source, series_id, source_url, retrieved_at)
    VALUES
      (${row.metricId}::text, 'official', ${row.value}::numeric, ${row.unit}::text,
       ${row.region}::text, ${row.period}::text, ${row.source}::text,
       ${row.seriesId}::text, ${row.sourceUrl}::text, ${row.retrievedAt}::timestamptz)`;
}

/**
 * Creates the store on an open client. The caller owns the client and closes it.
 * Errors are not caught here: runFetchJob turns a thrown error into the right
 * outcome for the series, and never prints the connection string.
 */
export function createPostgresFigureStore(sql: Sql): FigureStore {
  return {
    async count(): Promise<number> {
      const [row] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM figures`;
      return row.n;
    },

    async insertIfChanged(rows) {
      if (rows.length === 0) return { inserted: 0, revisions: 0 };
      const first = rows[0];
      // One series: the four series fields are the same for every row.
      const lockKey = [first.source, first.seriesId, first.unit, first.region].join("|");

      return sql.begin(async (tx) => {
        // Serialises writers for this series for the length of the transaction.
        await tx`SELECT pg_advisory_xact_lock(hashtext(${lockKey}::text))`;

        let inserted = 0;
        let revisions = 0;
        for (const row of rows) {
          // Read first: a row inserted for a period that already had one is a Revision_Row.
          const [prior] = await tx`
            SELECT 1 AS hit FROM figures
            WHERE source = ${row.source}::text AND series_id = ${row.seriesId}::text
              AND unit = ${row.unit}::text AND region = ${row.region}::text
              AND period = ${row.period}::text
            LIMIT 1`;
          const hadPeriod = prior !== undefined;

          // Insert only when the newest row for this series and period has a different value.
          const written = await tx`
            INSERT INTO figures
              (metric_id, kind, value, unit, region, period, source, series_id, source_url, retrieved_at)
            SELECT ${row.metricId}::text, 'official', ${row.value}::numeric, ${row.unit}::text,
                   ${row.region}::text, ${row.period}::text, ${row.source}::text,
                   ${row.seriesId}::text, ${row.sourceUrl}::text, ${row.retrievedAt}::timestamptz
            WHERE NOT EXISTS (
              SELECT 1 FROM (
                SELECT value FROM figures
                WHERE source = ${row.source}::text AND series_id = ${row.seriesId}::text
                  AND unit = ${row.unit}::text AND region = ${row.region}::text
                  AND period = ${row.period}::text
                ORDER BY retrieved_at DESC, id DESC
                LIMIT 1
              ) newest
              WHERE newest.value = ${row.value}::numeric
            )
            RETURNING id`;

          if (written.length > 0) {
            inserted += 1;
            if (hadPeriod) revisions += 1;
          }
        }
        return { inserted, revisions };
      });
    },

    async recordRun(rows) {
      await sql.begin(async (tx) => {
        for (const row of rows) {
          await tx`
            INSERT INTO figure_fetch_runs
              (run_started_at, metric_id, outcome, added, revisions, reason)
            VALUES
              (${row.runStartedAt.toISOString()}::timestamptz, ${row.metricId}::text,
               ${row.outcome}::text, ${row.added}::integer, ${row.revisions}::integer,
               ${row.reason}::text)`;
        }
      });
    },

    async seedFrom(rows) {
      // One transaction: a failure part way leaves no half-seeded table.
      await sql.begin(async (tx) => {
        for (const row of rows) {
          await insertFigure(tx, row);
        }
      });
    },
  };
}

/**
 * Opens a run session on a dedicated connection, reserved from the pool. The
 * session advisory lock belongs to the connection that takes it, so the lock and
 * the schema check both use this one connection, and `close` returns it to the
 * pool. Throws when the database cannot be reached; the caller decides whether to
 * retry. The lock key is the literal `hashtext('revenant-fetch-figures')`.
 */
export async function openFetchSession(sql: Sql): Promise<FetchSession> {
  const conn = await sql.reserve();
  return {
    async tryLock(): Promise<boolean> {
      const [row] = await conn<{ locked: boolean }[]>`
        SELECT pg_try_advisory_lock(hashtext('revenant-fetch-figures')) AS locked`;
      return row.locked === true;
    },
    async schemaReady(): Promise<boolean> {
      const [row] = await conn<{ ready: boolean }[]>`
        SELECT (to_regclass('figures') IS NOT NULL
                AND to_regclass('figure_fetch_runs') IS NOT NULL) AS ready`;
      return row.ready === true;
    },
    async unlock(): Promise<void> {
      await conn`SELECT pg_advisory_unlock(hashtext('revenant-fetch-figures'))`;
    },
    async close(): Promise<void> {
      conn.release();
    },
  };
}
