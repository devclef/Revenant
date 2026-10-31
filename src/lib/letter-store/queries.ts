// Server-only read and insert queries for the letter routes.
//
// `findLetter` reads a sealed letter row and the database `now()` in ONE
// parameterised statement, so the clock that decides whether a letter is open
// is the database's, read atomically with the row (R6.4, R8.4). The route
// never reads a client clock; it passes `dbNow` to the pure `isOpenable`.
//
// `insertOpening` appends one encrypted recall-answer record to the append-only
// `openings` table, writing `letter_id` XOR `demo_letter_id` so the table's
// `num_nonnulls(...) = 1` CHECK holds (R4.9, R7.4).
//
// Import boundary: this module imports only `@/lib/db/client` and
// `@/lib/db/schema/letters`. It never imports `@/lib/crypto`; it holds no key
// material and performs no cryptography, only storage. The `crypto.md`
// import-boundary test enforces this.
//
// No `console.*` anywhere: routes and `letter-store` must not log
// request-derived data (R8.1, R8.6). postgres-js errors (whose `detail` can
// echo a stored value) are caught and replaced with a value-free error, never
// chained via `cause`, so no driver detail leaks.
//
// This module must never be imported by browser code. The guard below throws if
// it is bundled into a client component, matching `clock.ts`, `http.ts` and
// `store.ts`.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/letter-store/queries.ts is server-only and must not be imported in the browser.",
  );
}

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { demoLetters, letters, openings } from "@/lib/db/schema/letters";

/**
 * A sealed-letter row as the routes need it, plus the database clock read in the
 * same statement.
 *
 * `serverSecret` is the raw 32 time-lock bytes (`bytea`, surfaced as a Node
 * `Buffer`). `demo` is `true` when the row came from `demo_letters`. `dbNow` is
 * the database `now()` captured in the same query, so the open/sealed decision
 * is made against the server clock, never a client-supplied time.
 */
export interface LetterRow {
  /** The 22-character letter ID. */
  id: string;
  /** The sealed envelope as canonical JSON text. */
  envelope: string;
  /** The SHA-256 of the canonical envelope (64 lowercase hex). */
  envelopeHash: string;
  /** The opening instant. */
  opensAt: Date;
  /** The 32-byte per-letter time-lock secret. */
  serverSecret: Buffer;
  /** `true` for a demo (persona) letter, `false` for a real letter. */
  demo: boolean;
  /** The database `now()`, read in the same statement as the row. */
  dbNow: Date;
}

/**
 * Read a letter by ID from either `letters` or `demo_letters`, together with the
 * database `now()`, in a single parameterised statement.
 *
 * The `id` is bound as a query parameter (never interpolated), and the same
 * `now()` is returned on every candidate row so the route decides openability
 * against the database clock read atomically with the row (R6.4, R8.4). A real
 * letter yields `demo = false`; a demo letter yields `demo = true`. Letter IDs
 * are unique across both tables in practice (128-bit random), so at most one
 * row matches; `LIMIT 1` is defensive.
 *
 * @param id The letter ID to look up. Bound as a parameter.
 * @returns The row with `dbNow`, or `null` when no letter has that ID.
 */
export async function findLetter(id: string): Promise<LetterRow | null> {
  const db = getDb();
  let rows: Record<string, unknown>[];
  try {
    rows = await db.execute(sql`
      SELECT
        ${letters.id}            AS id,
        ${letters.envelope}      AS envelope,
        ${letters.envelopeHash}  AS envelope_hash,
        ${letters.opensAt}       AS opens_at,
        ${letters.serverSecret}  AS server_secret,
        false                    AS demo,
        now()                    AS db_now
      FROM ${letters}
      WHERE ${letters.id} = ${id}
      UNION ALL
      SELECT
        ${demoLetters.id}           AS id,
        ${demoLetters.envelope}     AS envelope,
        ${demoLetters.envelopeHash} AS envelope_hash,
        ${demoLetters.opensAt}      AS opens_at,
        ${demoLetters.serverSecret} AS server_secret,
        true                        AS demo,
        now()                       AS db_now
      FROM ${demoLetters}
      WHERE ${demoLetters.id} = ${id}
      LIMIT 1
    `);
  } catch {
    // Any postgres-js error (connection, timeout, a constraint) can carry a
    // stored value in `detail`, so it is dropped and replaced with a value-free
    // error, never chained via `cause`. The route turns this into a 500.
    throw new Error("The letter could not be read.");
  }

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    envelope: String(row.envelope),
    envelopeHash: String(row.envelope_hash),
    opensAt: toDate(row.opens_at),
    serverSecret: toBuffer(row.server_secret),
    demo: row.demo === true,
    dbNow: toDate(row.db_now),
  };
}

/** Arguments to {@link insertOpening}. */
export interface InsertOpeningArgs {
  /** The letter being opened. */
  letterId: string;
  /** `true` when the letter lives in `demo_letters`, `false` for `letters`. */
  demo: boolean;
  /** The encrypted recall-answer record ciphertext (1–65,536 bytes). */
  ciphertext: Buffer;
  /** The 12-byte AES-GCM nonce. */
  nonce: Buffer;
}

/** The result of {@link insertOpening}: the new row's ID and opened instant. */
export interface InsertOpeningResult {
  /** The generated `openings.id` (UUID). */
  openingId: string;
  /** The `opened_at` instant, defaulted by Postgres to `now()`. */
  openedAt: Date;
}

/**
 * Append one encrypted opening record to the append-only `openings` table and
 * return its generated ID and `opened_at`.
 *
 * Exactly one of `letter_id` or `demo_letter_id` is written, chosen by `demo`,
 * so the table's `num_nonnulls(letter_id, demo_letter_id) = 1` CHECK holds
 * (R4.9, R7.4). `opened_at` is left to the Postgres `DEFAULT now()`, so the
 * recorded opening time is the database clock's, not the client's. `id` is
 * defaulted to `gen_random_uuid()` by the column. Both values come back via
 * `RETURNING`.
 *
 * @returns The new opening's ID and `opened_at`.
 */
export async function insertOpening(
  args: InsertOpeningArgs,
): Promise<InsertOpeningResult> {
  const { letterId, demo, ciphertext, nonce } = args;
  const db = getDb();
  let rows: Record<string, unknown>[];
  try {
    rows = await db
      .insert(openings)
      .values({
        // Write letter_id XOR demo_letter_id per the row's table, so
        // num_nonnulls(...) = 1. opened_at and id use their column defaults.
        letterId: demo ? null : letterId,
        demoLetterId: demo ? letterId : null,
        ciphertext,
        nonce,
      })
      .returning({ id: openings.id, openedAt: openings.openedAt });
  } catch {
    // postgres-js errors can echo a stored value in `detail`; drop and replace
    // with a value-free error, never chained. The route turns this into a 500.
    throw new Error("The opening could not be recorded.");
  }

  const row = rows[0];
  if (!row) {
    // RETURNING always yields a row on a successful INSERT; a missing one means
    // the driver behaved unexpectedly. Fail value-free rather than returning a
    // partial result.
    throw new Error("The opening could not be recorded.");
  }

  return {
    openingId: String(row.id),
    openedAt: toDate(row.openedAt),
  };
}

/**
 * Coerce a driver-returned timestamp to a `Date`. postgres-js returns
 * `timestamptz` as a `Date`; a defensive `new Date(...)` handles a string form
 * too. The value is server-origin (a column or `now()`), never client input.
 */
function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as string | number);
}

/**
 * Coerce a driver-returned `bytea` to a `Buffer`. postgres-js returns `bytea` as
 * a `Buffer`; the guard keeps the type honest without copying when it already
 * is one.
 */
function toBuffer(value: unknown): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
}
