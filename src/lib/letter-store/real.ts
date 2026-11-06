// Server-only store for real sealed letters (spec 08-judge-polish, R24).
//
// `storeRealLetter` validates a sealed envelope and its submitted hash, then in
// one transaction consumes the matching `letter_drafts` row and inserts the
// letter into `letters`. The server sets `sealed_at` from its own clock. The
// only time value taken from the request is `opens_at`, and it must meet the
// 3-calendar-month rule (`meetsRealLock`) against the database clock.
//
// `findRealDraft` and `findRealLetter` are the read side. They touch only the
// `letter_drafts` and `letters` tables; demo rows are never read or written here.
//
// Import boundary: this module imports `@/lib/db/client`, `@/lib/db/schema/letters`,
// `@/lib/seal-format` and `@/lib/letter-store/store` and `live-rules`. It never
// imports `@/lib/crypto`; it holds no key material and performs no cryptography.
// No `console.*`: driver errors are replaced with value-free errors.
//
// This module must never be imported by browser code. The guard below throws if
// it is bundled into a client component, matching `drafts.ts` and `store.ts`.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/letter-store/real.ts is server-only and must not be imported in the browser.",
  );
}

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { demoLetters, letterDrafts, letters } from "@/lib/db/schema/letters";
import {
  canonicalize,
  envelopeHash,
  meetsRealLock,
  parseEnvelope,
} from "@/lib/seal-format";
import { SEAL_LOCK_KEY } from "@/lib/letter-store/live-constants";
import { draftIsFresh } from "@/lib/letter-store/live-rules";
import {
  LetterStoreError,
  isUniqueViolation,
} from "@/lib/letter-store/store";

/** Arguments to {@link storeRealLetter}. */
export interface StoreRealLetterArgs {
  /** The sealed real-letter envelope as a parsed JSON value. */
  envelope: unknown;
  /** The SHA-256 of the canonical envelope, as submitted alongside it. */
  envelopeHash: string;
}

/** What a stored real letter reports back. `sealedAt` is the server's clock. */
export interface StoreRealLetterResult {
  letterId: string;
  sealedAt: Date;
  opensAt: Date;
}

/** A real draft row as stored in `letter_drafts`. */
export interface RealDraftRow {
  id: string;
  /** The 32-byte time-lock secret. Never logged or returned by this module's callers in a response. */
  serverSecret: Buffer;
  createdAt: Date;
}

/** A real letter row as stored in `letters`. */
export interface RealLetterRow {
  id: string;
  envelope: string;
  envelopeHash: string;
  sealedAt: Date;
  opensAt: Date;
  serverSecret: Buffer;
}

/**
 * Validate and store a sealed real letter, consuming its draft.
 *
 * The envelope is parsed and its hash re-checked first, before any database
 * access. Then one transaction runs, in this order:
 *   1. Take `pg_advisory_xact_lock(SEAL_LOCK_KEY)`.
 *   2. Read `clock_timestamp()` once. That is the server time `now`.
 *   3. Lock the draft row in `letter_drafts` (`SELECT ... FOR UPDATE`). No row,
 *      or a draft that is not fresh, throws `draft_not_found`.
 *   4. The ID must be absent from `letters` and `demo_letters`, else
 *      `duplicate_id`.
 *   5. `meetsRealLock(opens_at, now)` must hold, else `opens_at_too_early`.
 *   6. Insert into `letters` with `sealed_at = now` and the draft's
 *      `server_secret`, then delete the draft.
 *
 * Any throw rolls the whole transaction back, so the draft stays in place. A
 * unique-key violation on insert maps to `duplicate_id`. Any other driver error
 * becomes a value-free error, never chained via `cause`.
 */
export async function storeRealLetter(
  args: StoreRealLetterArgs,
): Promise<StoreRealLetterResult> {
  const { envelope, envelopeHash: submittedHash } = args;

  const parsed = parseEnvelope(envelope);
  if (!parsed.ok) {
    throw new LetterStoreError("envelope");
  }
  const header = parsed.value;

  const realHash = await envelopeHash(envelope);
  if (submittedHash !== realHash) {
    throw new LetterStoreError("hash_mismatch");
  }

  const id = header.letterId;
  const opensAt = new Date(header.opensAt);
  const canonicalEnvelope = canonicalize(envelope);

  const db = getDb();
  let sealedAt = new Date(0);
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
        SELECT ${letterDrafts.serverSecret}, ${letterDrafts.createdAt}
        FROM ${letterDrafts}
        WHERE ${letterDrafts.id} = ${id}
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

      if (!meetsRealLock(opensAt.getTime(), now.getTime())) {
        throw new LetterStoreError("opens_at_too_early");
      }

      // The server sets sealed_at; the request never supplies it (R24.14).
      sealedAt = now;
      await tx.execute(sql`
        INSERT INTO ${letters}
          (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
        VALUES
          (${id}, ${canonicalEnvelope}, ${realHash}, ${now.toISOString()}, ${opensAt.toISOString()}, ${draft.server_secret})
      `);

      await tx.execute(sql`
        DELETE FROM ${letterDrafts} WHERE ${letterDrafts.id} = ${id}
      `);
    });
  } catch (error) {
    if (error instanceof LetterStoreError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      throw new LetterStoreError("duplicate_id");
    }
    throw new Error("The letter could not be stored.");
  }

  return { letterId: id, sealedAt, opensAt };
}

/**
 * Read a real draft by letter ID from `letter_drafts`.
 *
 * @returns The draft row, or `null` when no draft has that ID. Expiry is not
 *   applied here; callers check freshness with `draftIsFresh`.
 */
export async function findRealDraft(id: string): Promise<RealDraftRow | null> {
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await getDb().execute<Record<string, unknown>>(sql`
      SELECT ${letterDrafts.id} AS id,
             ${letterDrafts.serverSecret} AS server_secret,
             ${letterDrafts.createdAt} AS created_at
      FROM ${letterDrafts}
      WHERE ${letterDrafts.id} = ${id}
    `);
  } catch {
    throw new Error("The draft could not be read.");
  }
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    id: String(row.id),
    serverSecret: Buffer.from(row.server_secret as Uint8Array),
    createdAt: new Date(row.created_at as string | Date),
  };
}

/**
 * Read a real sealed letter by letter ID from `letters`.
 *
 * @returns The letter row, or `null` when no real letter has that ID.
 */
export async function findRealLetter(id: string): Promise<RealLetterRow | null> {
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await getDb().execute<Record<string, unknown>>(sql`
      SELECT ${letters.id} AS id,
             ${letters.envelope} AS envelope,
             ${letters.envelopeHash} AS envelope_hash,
             ${letters.sealedAt} AS sealed_at,
             ${letters.opensAt} AS opens_at,
             ${letters.serverSecret} AS server_secret
      FROM ${letters}
      WHERE ${letters.id} = ${id}
    `);
  } catch {
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
    sealedAt: new Date(row.sealed_at as string | Date),
    opensAt: new Date(row.opens_at as string | Date),
    serverSecret: Buffer.from(row.server_secret as Uint8Array),
  };
}
