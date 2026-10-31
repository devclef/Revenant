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
