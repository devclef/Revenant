import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration.
 *
 * `schema` picks up every file in `src/lib/db/schema/` (one per owning role,
 * for example `letters.ts` and `figures*.ts`), so no shared barrel file is needed. `out` is the
 * migrations directory the migrate script reads.
 *
 * Credentials come from `DATABASE_URL`. The value is never embedded or logged
 * here; if it is unset, drizzle-kit reports a missing-URL error without the
 * value.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/*.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
