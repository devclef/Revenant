// Server-only harness for the Postgres integration tests.
//
// `describeDb` wraps `describe` with a Postgres guard so the integration suite
// runs only against a real test database, and never silently passes by skipping
// in CI:
//
//   - When `DATABASE_URL` is unset, or the database name it points at does not
//     contain `test`, the block is skipped locally (`describe.skip`) with a
//     message saying how to enable it. This keeps `npm test` green on a machine
//     with no database.
//   - When `CI` is set, skipping is not allowed: a block that would otherwise be
//     skipped runs a single failing test instead, so CI cannot pass the suite by
//     skipping it. CI is expected to provide a `test` database.
//   - Otherwise the block runs, and `beforeAll` applies the migrations against
//     `./drizzle`. The migrator is idempotent, so re-running it across files and
//     runs is a no-op after the first.
//
// This module is server-only; the guard below throws if it is bundled into a
// browser build, matching `lib/db/client.ts`. It never logs `DATABASE_URL`.
if (typeof window !== "undefined") {
  throw new Error(
    "src/test/integration/setup.ts is server-only and must not be imported in the browser.",
  );
}

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { beforeAll, describe, it } from "vitest";

/** The message shown when the suite is skipped for want of a test database. */
const SKIP_MESSAGE =
  "needs Postgres: set DATABASE_URL to a database whose name contains 'test'";

/**
 * Parse the database name from a `DATABASE_URL`, returning `undefined` when the
 * URL is missing, unparseable, or has no database path. Only the name is read;
 * the value itself is never logged. The leading slash of the URL path is
 * stripped, and any remaining path segments (rare, but possible) are ignored —
 * the database name is the first segment.
 */
function databaseName(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const name = parsed.pathname.replace(/^\//, "").split("/")[0];
  return name.length > 0 ? decodeURIComponent(name) : undefined;
}

/**
 * True when `DATABASE_URL` points at a database whose name contains `test`.
 * This is the single gate deciding whether the integration suite may run: a
 * `test` in the name is the operator's explicit opt-in that the database is
 * disposable, since the suite migrates and writes to it.
 */
function hasTestDatabase(): boolean {
  const name = databaseName(process.env.DATABASE_URL);
  return name !== undefined && name.includes("test");
}

/** True when running under CI (the `CI` environment variable is set). */
function isCI(): boolean {
  return Boolean(process.env.CI);
}

/**
 * Run the Drizzle migrator against `./drizzle` once per file, in `beforeAll`.
 * The migrator is idempotent: drizzle-orm records applied migrations in its
 * journal table, so repeated runs across files are no-ops. A dedicated
 * single-connection client is opened and closed so the suite leaves no pooled
 * connections behind. `DATABASE_URL` is never logged.
 *
 * Vitest runs each test file in its own worker in parallel, so every file's
 * `beforeAll` calls this at once. On a fresh database their first migration
 * runs would race to CREATE the same tables and types and one would fail with a
 * duplicate-key error on `pg_type`. A session-level Postgres advisory lock
 * serialises them: the first connection to arrive migrates while the others
 * wait on the same lock, and once it releases they each find the migrations
 * already recorded in the journal and do nothing. The lock key is an arbitrary
 * fixed constant, unique to this migrator.
 */
const MIGRATION_ADVISORY_LOCK_KEY = 0x5265_7641; // "RevA" — arbitrary, fixed.

async function applyMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Unreachable: `describeDb` only calls this when a test database is present.
    throw new Error(SKIP_MESSAGE);
  }
  const sql = postgres(url, { max: 1 });
  try {
    // Block until no other test-file worker is mid-migration. The lock is held
    // for this session only and released below, so a crash still frees it when
    // the connection closes.
    await sql`SELECT pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY})`;
    try {
      const db = drizzle(sql);
      await migrate(db, { migrationsFolder: "./drizzle" });
    } finally {
      await sql`SELECT pg_advisory_unlock(${MIGRATION_ADVISORY_LOCK_KEY})`;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Declare an integration test block that needs a real Postgres database.
 *
 * Use it exactly like `describe`: `describeDb("schema", () => { it(...) })`.
 * The body's `beforeAll` runs the migrations (idempotent), so each file is free
 * to assume the schema exists.
 *
 * Gating, in order:
 *   1. A test database is present (`DATABASE_URL` names a database containing
 *      `test`): run the block, migrating first.
 *   2. No test database, but `CI` is set: run a single failing test, so the
 *      suite cannot pass in CI by skipping. CI must supply a `test` database.
 *   3. No test database and not CI: skip with `SKIP_MESSAGE`.
 */
export function describeDb(name: string, body: () => void): void {
  if (hasTestDatabase()) {
    describe(name, () => {
      beforeAll(async () => {
        await applyMigrations();
      }, 60_000);
      body();
    });
    return;
  }

  if (isCI()) {
    // In CI a missing test database is a configuration failure, not a reason to
    // skip: a skipped suite would let a broken migration or schema pass CI
    // unnoticed. Fail loudly instead.
    describe(name, () => {
      it("requires a Postgres test database in CI", () => {
        throw new Error(SKIP_MESSAGE);
      });
    });
    return;
  }

  describe.skip(`${name} (${SKIP_MESSAGE})`, body);
}
