#!/usr/bin/env node
// Run pending Drizzle migrations against the database named by DATABASE_URL.
//
// Idempotent: drizzle-orm records applied migrations in its journal table, so a
// second run with no new migrations is a no-op. There are no tables yet, so on a
// fresh database this only creates the migrations bookkeeping table.
//
// DATABASE_URL (and any other secret) is never printed. On failure the process
// exits non-zero with a message that excludes the connection string.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "DATABASE_URL is not set. Define it in the environment before running migrations.",
  );
  process.exit(1);
}

// `max: 1` keeps a single connection for the migration run; drizzle-kit's
// default migrations folder is ./drizzle, where _journal.json lives.
const sql = postgres(databaseUrl, { max: 1 });

try {
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied. Database is up to date.");
} catch (error) {
  // Report the failure without echoing DATABASE_URL. Error messages from the
  // driver do not embed the connection string, but we surface only the message.
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration failed: ${message}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
