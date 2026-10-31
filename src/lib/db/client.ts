import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Sql } from "postgres";

/**
 * Server-only Drizzle client.
 *
 * The connection string comes from `DATABASE_URL`. No schema or tables are
 * defined here yet; this module only establishes the client. Never log the
 * connection string: the error below intentionally omits its value.
 *
 * This module must never be imported by browser code. The guard below throws if
 * it is bundled into a client component, and `lib/crypto`, not this module, is
 * where browser code lives.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/db/client.ts is server-only and must not be imported in the browser.",
  );
}

/**
 * Read `DATABASE_URL` from the environment, throwing a clear error if it is
 * unset or empty. The error message never includes the value, so it is safe to
 * log and surface.
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Define it in the environment before connecting to the database.",
    );
  }
  return url;
}

let sqlClient: Sql | undefined;
let dbInstance: PostgresJsDatabase | undefined;
let probeClient: Sql | undefined;

/**
 * How long the readiness probe waits for Postgres before giving up, in
 * milliseconds. The `/api/health/ready` route must answer within ~2 s even when
 * the database hangs, so the probe is bounded to this value.
 */
const READINESS_PROBE_TIMEOUT_MS = 2000;

/**
 * The raw postgres-js SQL client, created on first use. Exposed for the migrate
 * script, which needs a dedicated client it can close when done. Reading
 * `DATABASE_URL` is deferred until a connection is actually needed, so importing
 * this module does not require the environment variable to be set.
 */
export function getSql(): Sql {
  if (!sqlClient) {
    sqlClient = postgres(getDatabaseUrl());
  }
  return sqlClient;
}

/** The Drizzle database instance used by server code, created on first use. */
export function getDb(): PostgresJsDatabase {
  if (!dbInstance) {
    dbInstance = drizzle(getSql());
  }
  return dbInstance;
}

/**
 * A dedicated probe client for the readiness check, created on first use. It
 * carries short `connect_timeout` and `idle_timeout` values (in seconds) so a
 * stalled TCP connect does not leave the probe hanging past its bound, and so
 * the probe does not hold an idle connection open between checks. Kept separate
 * from `getSql()` so readiness probing never perturbs the main client's pool.
 */
function getProbeSql(): Sql {
  if (!probeClient) {
    probeClient = postgres(getDatabaseUrl(), {
      max: 1,
      connect_timeout: 2,
      idle_timeout: 2,
    });
  }
  return probeClient;
}

/**
 * Run a trivial `SELECT 1` to confirm the database is reachable, bounded to
 * ~2 s so the readiness probe always answers in time even when Postgres hangs.
 * Resolves `true` on success. On any failure, or on timeout, it rejects with a
 * value-free error so the connection string is never echoed into logs or
 * responses: the underlying error (which may embed `DATABASE_URL`) is
 * deliberately discarded and never chained. Used by the readiness probe.
 */
export async function checkDatabaseConnection(): Promise<true> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Database connection check failed."));
    }, READINESS_PROBE_TIMEOUT_MS);
  });

  const probe = (async (): Promise<true> => {
    try {
      await getProbeSql()`select 1`;
      return true;
    } catch {
      throw new Error("Database connection check failed.");
    }
  })();

  try {
    return await Promise.race([probe, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
