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
import { demoLetters, letters } from "@/lib/db/schema/letters";
import { canonicalize, envelopeHash, parseEnvelope } from "@/lib/seal-format";

/**
 * Which validation step rejected a `storePersonaLetter` call.
 *   - `envelope`: the envelope did not parse as a known, valid sealed format.
 *   - `server_secret`: the time-lock secret was not exactly 32 bytes.
 *   - `hash_mismatch`: the submitted hash did not match the envelope's real hash.
 *   - `duplicate_id`: the letter ID already exists in `letters` or `demo_letters`.
 */
export type LetterStoreCheck =
  | "envelope"
  | "server_secret"
  | "hash_mismatch"
  | "duplicate_id"
  | "busy";

/**
 * A fixed message per check. These strings never include any submitted value
 * (no ID, hash, secret or driver detail), so they are safe to log and surface.
 */
const MESSAGES: Record<LetterStoreCheck, string> = {
  envelope: "The sealed envelope is not a valid letter.",
  server_secret: "The server secret must be exactly 32 bytes.",
  hash_mismatch: "The envelope hash does not match the envelope.",
  duplicate_id: "A letter with this ID already exists.",
  busy: "The service is busy. Try again in a moment.",
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
