import { sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Drizzle schema for the sealed-letter tables: `letters`, `demo_letters` and
 * `openings`.
 *
 * This file defines table shapes, column types and CHECK constraints only. The
 * immutability triggers (`BEFORE UPDATE OR DELETE`/`BEFORE TRUNCATE` that raise)
 * are not expressible in drizzle-kit, so they are appended by hand to the
 * generated migration `drizzle/0000_sealed_letters.sql` after the generated DDL.
 *
 * Per the design doc, column types and CHECKs are:
 *   - Letter IDs are the 22-character URL form of a 16-byte value, validated by
 *     a regex that pins exactly that encoding.
 *   - `server_secret`, `ciphertext` and `nonce` are raw bytes, so they use a
 *     `bytea` custom type (drizzle-orm 0.45 has no built-in `bytea`).
 *   - All timestamps are `timestamptz`.
 *
 * This module must never import `lib/crypto`; it holds no key material and
 * performs no cryptography. It only describes the storage shape.
 */

/**
 * A `bytea` column type for raw binary values. drizzle-orm 0.45 has no built-in
 * `bytea`, so this custom type maps the Postgres `bytea` type to a Node
 * `Buffer` on the TypeScript side.
 */
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Columns shared by `letters` and `demo_letters`. Both hold a sealed envelope
 * (canonical JSON `text`), its SHA-256 hash (lowercase 64-hex), the sealing and
 * opening instants (`timestamptz`), and the 32-byte per-letter time-lock
 * `server_secret`.
 */
const sharedLetterColumns = {
  id: text("id").primaryKey(),
  envelope: text("envelope").notNull(),
  envelopeHash: text("envelope_hash").notNull(),
  sealedAt: timestamp("sealed_at", { withTimezone: true }).notNull(),
  opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
  serverSecret: bytea("server_secret").notNull(),
};

/**
 * Real sealed letters. In addition to the shared constraints, a real letter
 * must open at least three months after it was sealed. The UTC conversion makes
 * the month arithmetic independent of the session `TimeZone`.
 */
export const letters = pgTable(
  "letters",
  sharedLetterColumns,
  (table) => [
    check("letters_id_format", sql`${table.id} ~ '^[A-Za-z0-9_-]{21}[AQgw]$'`),
    check(
      "letters_envelope_hash_format",
      sql`${table.envelopeHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "letters_server_secret_len",
      sql`octet_length(${table.serverSecret}) = 32`,
    ),
    check(
      "letters_opens_at_min_lock",
      sql`(${table.opensAt} AT TIME ZONE 'UTC') >= (${table.sealedAt} AT TIME ZONE 'UTC') + interval '3 months'`,
    ),
  ],
);

/**
 * Demo persona letters. Same shared constraints as `letters`, but no minimum
 * lock period, plus a `kind` discriminator: `'persona'` or `'live'`. A `live`
 * row must open exactly 30 seconds after it was sealed (`demo_letters_live_lock`).
 */
export const demoLetters = pgTable(
  "demo_letters",
  {
    ...sharedLetterColumns,
    kind: text("kind").notNull(),
  },
  (table) => [
    check(
      "demo_letters_id_format",
      sql`${table.id} ~ '^[A-Za-z0-9_-]{21}[AQgw]$'`,
    ),
    check(
      "demo_letters_envelope_hash_format",
      sql`${table.envelopeHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "demo_letters_server_secret_len",
      sql`octet_length(${table.serverSecret}) = 32`,
    ),
    check("demo_letters_kind", sql`${table.kind} IN ('persona', 'live')`),
    check(
      "demo_letters_live_lock",
      sql`${table.kind} <> 'live' OR ${table.opensAt} = ${table.sealedAt} + interval '30 seconds'`,
    ),
  ],
);

/**
 * Drafts for live demo letters. A draft holds the 32-byte `server_secret` that
 * the Prepare_Route issues, and it is deleted when the Seal_Route uses it or
 * when it expires. It holds no letter content, so it has no immutability
 * trigger.
 */
export const demoLetterDrafts = pgTable(
  "demo_letter_drafts",
  {
    id: text("id").primaryKey(),
    serverSecret: bytea("server_secret").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    check(
      "demo_letter_drafts_id_format",
      sql`${table.id} ~ '^[A-Za-z0-9_-]{21}[AQgw]$'`,
    ),
    check(
      "demo_letter_drafts_server_secret_len",
      sql`octet_length(${table.serverSecret}) = 32`,
    ),
    index("demo_letter_drafts_created_at_idx").on(table.createdAt),
  ],
);

/**
 * Append-only record of each opening. A row references exactly one of a real
 * letter or a demo letter (enforced by the `num_nonnulls` table CHECK), and
 * holds the encrypted recall answers (`ciphertext`) with their `nonce`. The
 * `opened_at` timestamp is defaulted by Postgres.
 */
export const openings = pgTable(
  "openings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    letterId: text("letter_id").references(() => letters.id),
    demoLetterId: text("demo_letter_id").references(() => demoLetters.id),
    ciphertext: bytea("ciphertext").notNull(),
    nonce: bytea("nonce").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    check(
      "openings_ciphertext_len",
      sql`octet_length(${table.ciphertext}) BETWEEN 1 AND 65536`,
    ),
    check("openings_nonce_len", sql`octet_length(${table.nonce}) = 12`),
    check(
      "openings_exactly_one_letter",
      sql`num_nonnulls(${table.letterId}, ${table.demoLetterId}) = 1`,
    ),
    index("openings_letter_id_idx").on(table.letterId),
    index("openings_demo_letter_id_idx").on(table.demoLetterId),
  ],
);
