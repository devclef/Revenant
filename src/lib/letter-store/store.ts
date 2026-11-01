// Server-only store for sealed persona letters.
//
// `storePersonaLetter` validates a sealed envelope, its submitted hash and its
// time-lock `serverSecret`, then inserts it into `demo_letters` with
// `kind = 'persona'`. It is the only write path for persona demo letters.
//
// Import boundary: this module imports only `@/lib/seal-format` and
// `@/lib/db/client`. It never imports `@/lib/crypto` — it holds no key material
// and performs no cryptography, only validation and storage. The `crypto.md`
// import-boundary test enforces this.
//
// This module must never be imported by browser code. The guard below throws if
// it is bundled into a client component, matching `lib/db/client.ts`.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/letter-store/store.ts is server-only and must not be imported in the browser.",
  );
}

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { demoLetterDrafts, demoLetters, letters } from "@/lib/db/schema/letters";
import { canonicalize, envelopeHash, parseEnvelope } from "@/lib/seal-format";
import {
  LIVE_SEAL_CAP,
  LIVE_SEAL_WINDOW_MS,
  LIVE_KIND,
  SEAL_LOCK_KEY,
} from "@/lib/letter-store/live-constants";
import { draftIsFresh, lockRuleHolds } from "@/lib/letter-store/live-rules";

/**
 * Which validation step rejected a store call.
 *   - `envelope`: the envelope did not parse as a known, valid sealed format.
 *   - `server_secret`: the time-lock secret was not exactly 32 bytes.
 *   - `hash_mismatch`: the submitted hash did not match the envelope's real hash.
 *   - `duplicate_id`: the letter ID already exists in `letters` or `demo_letters`.
 *   - `draft_not_found`: no fresh Draft exists for the letter ID (`storeLiveLetter`).
 *   - `busy`: the rolling Live_Letter cap is reached (`storeLiveLetter`), or the draft cap is reached (`createDraft`).
 *   - `lock_out_of_range`: the envelope's Lock rule does not hold (`storeLiveLetter`).
 */
export type LetterStoreCheck =
  | "envelope"
  | "server_secret"
  | "hash_mismatch"
  | "duplicate_id"
  | "draft_not_found"
  | "busy"
  | "lock_out_of_range";

/**
 * A fixed message per check. These strings never include any submitted value
 * (no ID, hash, secret or driver detail), so they are safe to log and surface.
 */
const MESSAGES: Record<LetterStoreCheck, string> = {
  envelope: "The sealed envelope is not a valid letter.",
  server_secret: "The server secret must be exactly 32 bytes.",
  hash_mismatch: "The envelope hash does not match the envelope.",
  duplicate_id: "A letter with this ID already exists.",
  draft_not_found: "No fresh draft exists for this letter.",
  busy: "The service is busy. Try again in a moment.",
  lock_out_of_range:
    "The lock must open 30 seconds after sealing, within the allowed window.",
};

/**
 * Error thrown by the letter store. `check` names the step that failed; the
 * message is a fixed string for that check and never carries a value. Postgres
 * driver errors (whose `detail` can echo a stored value) are caught and
 * replaced with one of these, never chained via `cause`.
 */
export class LetterStoreError extends Error {
  readonly check: LetterStoreCheck;

  constructor(check: LetterStoreCheck) {
    super(MESSAGES[check]);
    this.name = "LetterStoreError";
    this.check = check;
  }
}

/** The number of bytes a time-lock `serverSecret` must be. */
const SERVER_SECRET_BYTES = 32;

/** Arguments to {@link storePersonaLetter}. */
export interface StorePersonaLetterArgs {
  /** The sealed envelope (header + ciphertext) as a parsed JSON value. */
  envelope: unknown;
  /** The SHA-256 of the canonical envelope, as submitted alongside it. */
  envelopeHash: string;
  /** The 32-byte per-letter time-lock secret. */
  serverSecret: Uint8Array;
}

/**
 * Validate and store a sealed persona letter in `demo_letters`.
 *
 * Steps, in order, so a mismatch is caught before any database query runs:
 *   1. Parse the envelope; a parse failure throws `check: "envelope"`.
 *   2. Require `serverSecret` to be exactly 32 bytes; else `check: "server_secret"`.
 *   3. Recompute the envelope hash and compare with the submitted one; a
 *      mismatch throws `check: "hash_mismatch"` and touches no database.
 *   4. In one transaction, confirm the ID is absent from both `letters` and
 *      `demo_letters`, then insert into `demo_letters` with `kind = 'persona'`.
 *      A present ID, or a primary-key violation, throws `check: "duplicate_id"`.
 *
 * `id`, `sealed_at` and `opens_at` are taken from the parsed header; `envelope`
 * is stored as `canonicalize(envelope)`. A past `opens_at` is accepted: persona
 * letters carry historical opening dates. Any postgres-js error is caught and
 * replaced so no driver detail leaks (never chained via `cause`).
 */
export async function storePersonaLetter(
  args: StorePersonaLetterArgs,
): Promise<void> {
  const { envelope, envelopeHash: submittedHash, serverSecret } = args;

  // 1. Envelope must parse as a known, valid sealed format.
  const parsed = parseEnvelope(envelope);
  if (!parsed.ok) {
    throw new LetterStoreError("envelope");
  }
  const header = parsed.value;

  // 2. Server secret must be exactly 32 bytes.
  if (serverSecret.byteLength !== SERVER_SECRET_BYTES) {
    throw new LetterStoreError("server_secret");
  }

  // 3. The submitted hash must match the envelope's real hash. This runs
  //    before any database access, so a mismatch never touches Postgres.
  const realHash = await envelopeHash(envelope);
  if (submittedHash !== realHash) {
    throw new LetterStoreError("hash_mismatch");
  }

  const id = header.letterId;
  const sealedAt = new Date(header.sealedAt);
  const opensAt = new Date(header.opensAt);
  const canonicalEnvelope = canonicalize(envelope);

  // 4. One transaction: the ID must be absent from both tables, then insert.
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const existing = await tx.execute(sql`
        SELECT 1 AS present
        WHERE EXISTS (SELECT 1 FROM ${letters} WHERE ${letters.id} = ${id})
           OR EXISTS (SELECT 1 FROM ${demoLetters} WHERE ${demoLetters.id} = ${id})
      `);
      if (existing.length > 0) {
        throw new LetterStoreError("duplicate_id");
      }

      await tx.insert(demoLetters).values({
        id,
        kind: "persona",
        envelope: canonicalEnvelope,
        envelopeHash: realHash,
        sealedAt,
        opensAt,
        serverSecret: Buffer.from(serverSecret),
      });
    });
  } catch (error) {
    // Our own duplicate signal, re-raised unchanged.
    if (error instanceof LetterStoreError) {
      throw error;
    }
    // A primary-key violation means a concurrent insert of the same ID. Map it
    // to `duplicate_id`. The driver error can carry the key value in `detail`,
    // so it is dropped, never chained via `cause`.
    if (isUniqueViolation(error)) {
      throw new LetterStoreError("duplicate_id");
    }
    // Any other postgres-js error (connection, timeout, a different constraint)
    // is not one of the store's checks, so it is replaced with a value-free
    // error and never chained. The route layer turns it into a 500.
    throw new Error("The letter could not be stored.");
  }
}

/** Arguments to {@link storeLiveLetter}. The time-lock secret comes from the Draft, not the caller. */
export interface StoreLiveLetterArgs {
  /** The sealed Live_Letter envelope as a parsed JSON value. */
  envelope: unknown;
  /** The SHA-256 of the canonical envelope, as submitted alongside it. */
  envelopeHash: string;
}

/** What a stored Live_Letter reports back: the header fields the Seal_Route returns. */
export interface StoreLiveLetterResult {
  letterId: string;
  sealedAt: Date;
  opensAt: Date;
}

/**
 * Validate and store a sealed Live_Letter, consuming its Draft.
 *
 * The envelope is parsed and its hash re-checked first, before any database
 * access. Then one transaction runs, in this order:
 *   1. Take `pg_advisory_xact_lock(SEAL_LOCK_KEY)`.
 *   2. Read `clock_timestamp()` once. That is the server time `now`.
 *   3. Lock the Draft row (`SELECT ... FOR UPDATE`). No row, or a Draft that is
 *      not fresh, throws `draft_not_found`.
 *   4. The ID must be absent from `letters` and `demo_letters`, else
 *      `duplicate_id`.
 *   5. Count live rows sealed in the last `LIVE_SEAL_WINDOW_MS`. A count above
 *      `LIVE_SEAL_CAP` throws `busy`, so exactly `LIVE_SEAL_CAP` rows still accept.
 *   6. `lockRuleHolds` must be true, else `lock_out_of_range`.
 *   7. Insert the row into `demo_letters` with `kind = 'live'`, using the
 *      Draft's `server_secret`, then delete the Draft.
 *
 * Any throw rolls the whole transaction back, so the Draft stays in place. A
 * unique-key violation on insert (a concurrent write of the same ID) maps to
 * `duplicate_id`. Any other driver error becomes a value-free error, never
 * chained via `cause`.
 */
export async function storeLiveLetter(
  args: StoreLiveLetterArgs,
): Promise<StoreLiveLetterResult> {
  const { envelope, envelopeHash: submittedHash } = args;

  // Envelope must parse as a known, valid sealed format.
  const parsed = parseEnvelope(envelope);
  if (!parsed.ok) {
    throw new LetterStoreError("envelope");
  }
  const header = parsed.value;

  // The submitted hash must match the envelope's real hash, before any query.
  const realHash = await envelopeHash(envelope);
  if (submittedHash !== realHash) {
    throw new LetterStoreError("hash_mismatch");
  }

  const id = header.letterId;
  const sealedAt = new Date(header.sealedAt);
  const opensAt = new Date(header.opensAt);
  const canonicalEnvelope = canonicalize(envelope);

  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEAL_LOCK_KEY})`);

      const [clock] = await tx.execute<{ t: Date }>(
        sql`SELECT clock_timestamp() AS t`,
      );
      const now = new Date(clock.t);

      const drafts = await tx.execute<{
        server_secret: Buffer;
        created_at: Date;
      }>(sql`
        SELECT ${demoLetterDrafts.serverSecret}, ${demoLetterDrafts.createdAt}
        FROM ${demoLetterDrafts}
        WHERE ${demoLetterDrafts.id} = ${id}
        FOR UPDATE
      `);
      const draft = drafts[0];
      if (!draft || !draftIsFresh(new Date(draft.created_at), now)) {
        throw new LetterStoreError("draft_not_found");
      }

      const taken = await tx.execute(sql`
        SELECT 1 AS present
        WHERE EXISTS (SELECT 1 FROM ${letters} WHERE ${letters.id} = ${id})
           OR EXISTS (SELECT 1 FROM ${demoLetters} WHERE ${demoLetters.id} = ${id})
      `);
      if (taken.length > 0) {
        throw new LetterStoreError("duplicate_id");
      }

      const [counted] = await tx.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM ${demoLetters}
        WHERE ${demoLetters.kind} = ${LIVE_KIND}
          AND ${demoLetters.sealedAt} > ${new Date(now.getTime() - LIVE_SEAL_WINDOW_MS)}
      `);
      if (counted.n > LIVE_SEAL_CAP) {
        throw new LetterStoreError("busy");
      }

      if (!lockRuleHolds(sealedAt, opensAt, now)) {
        throw new LetterStoreError("lock_out_of_range");
      }

      await tx.execute(sql`
        INSERT INTO ${demoLetters}
          (id, kind, envelope, envelope_hash, sealed_at, opens_at, server_secret)
        VALUES
          (${id}, ${LIVE_KIND}, ${canonicalEnvelope}, ${realHash}, ${sealedAt}, ${opensAt}, ${draft.server_secret})
      `);

      await tx.execute(sql`
        DELETE FROM ${demoLetterDrafts} WHERE ${demoLetterDrafts.id} = ${id}
      `);
    });
  } catch (error) {
    // Our own checks are re-raised unchanged.
    if (error instanceof LetterStoreError) {
      throw error;
    }
    // A unique-key violation on insert is a concurrent write of the same ID.
    if (isUniqueViolation(error)) {
      throw new LetterStoreError("duplicate_id");
    }
    // Any other driver error is replaced with a value-free error, never chained.
    throw new Error("The letter could not be stored.");
  }

  return { letterId: id, sealedAt, opensAt };
}

/**
 * True when a caught error is a Postgres unique/primary-key violation
 * (SQLSTATE 23505). postgres-js surfaces the SQLSTATE on the error's `code`
 * field. Read defensively without widening the type to the driver's.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
