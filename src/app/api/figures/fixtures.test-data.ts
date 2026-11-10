// TEST FIXTURES ONLY. Not real figures, not published data, never shown in the app.
//
// Failure-shape fixtures for the GET /api/figures harness (spec X1, issue #335).
// Each export is one shape the figures route must handle. Every value here is
// fake and is marked with source "FIXTURE" so isFixtureFigure() recognises it.
// No row in this file is an owner row; the owner-row fixtures come in a later task.
//
// Import from test files only. Nothing under src/app/api/figures imports this
// module at runtime.

import type { FigureReadStore, StoredFigureRow } from "./db-response";

const FIXTURE_SOURCE_URL = "https://test.invalid/fixture-figure";
const FIXTURE_SOURCE = "FIXTURE";

/**
 * A stored row whose retrieved_at is an Invalid Date. The row is otherwise a
 * complete, well-formed row for a fake series, so only the timestamp is wrong.
 */
export const INVALID_RETRIEVED_AT_ROW: StoredFigureRow = {
  metric_id: "fixture-metric-invalid-time",
  kind: "official",
  value: "1.000",
  unit: "FIXTURE unit",
  region: "FIXTURE region",
  period: "2026-01",
  source: FIXTURE_SOURCE,
  series_id: "FIXTURE-INVALID-TIME",
  source_url: FIXTURE_SOURCE_URL,
  retrieved_at: new Date("not-a-date"),
};

/**
 * A stored row whose retrieved_at is null. The database column should never be
 * null, so the cast to Date only reproduces a bad read on purpose.
 */
export const NULL_RETRIEVED_AT_ROW: StoredFigureRow = {
  metric_id: "fixture-metric-null-time",
  kind: "official",
  value: "2.000",
  unit: "FIXTURE unit",
  region: "FIXTURE region",
  period: "2026-01",
  source: FIXTURE_SOURCE,
  series_id: "FIXTURE-NULL-TIME",
  source_url: FIXTURE_SOURCE_URL,
  retrieved_at: null as unknown as Date,
};

/**
 * A stored row for a series that is not in the Catalogue. The route ignores
 * rows that no Catalogue series owns, so this row must never reach a response.
 */
export const OUTSIDE_CATALOGUE_ROW: StoredFigureRow = {
  metric_id: "fixture-metric-outside-catalogue",
  kind: "official",
  value: "3.000",
  unit: "FIXTURE unit",
  region: "FIXTURE region",
  period: "2026-01",
  source: FIXTURE_SOURCE,
  series_id: "FIXTURE-OUTSIDE-CATALOGUE",
  source_url: FIXTURE_SOURCE_URL,
  retrieved_at: new Date("2026-01-15T00:00:00Z"),
};

/**
 * The error a Postgres statement timeout raises (SQLSTATE 57014). It is an Error
 * instance named PostgresError, as the postgres client builds it, so the failure
 * line reads the name the way production does.
 */
export const POSTGRES_TIMEOUT_ERROR = Object.assign(
  new Error("canceling statement due to statement timeout"),
  { name: "PostgresError", code: "57014" },
);

/**
 * The error a dropped database connection raises. Its message carries a fake
 * connection string on purpose, so the tests can check that neither the log line
 * nor the body echoes it.
 */
export const CONNECTION_CLOSED_ERROR = Object.assign(
  new Error("write CONNECTION_CLOSED postgres://user:secret@host/db"),
  { code: "CONNECTION_CLOSED" },
);

/** A read store whose latestFigures rejects with the given error. */
export function rejectingLatestFiguresStore(err: unknown): FigureReadStore {
  return {
    latestFigures: () => Promise.reject(err),
    lastSuccessTimes: () => Promise.resolve(new Map()),
  };
}

/** A read store whose latestFigures rejects with a Postgres statement timeout. */
export const STATEMENT_TIMEOUT_STORE: FigureReadStore = rejectingLatestFiguresStore(
  POSTGRES_TIMEOUT_ERROR,
);

/** A read store whose latestFigures rejects with a closed connection. */
export const CONNECTION_CLOSED_STORE: FigureReadStore = rejectingLatestFiguresStore(
  CONNECTION_CLOSED_ERROR,
);
