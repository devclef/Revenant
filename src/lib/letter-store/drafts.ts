// Server-only draft store for Live_Letters.
//
// `createDraft` issues the letter ID and the 32-byte time-lock `serverSecret`
// that the Seal_Route later uses. The draft row is written in one transaction
// that takes a Postgres advisory lock, reads the database clock once, removes
// expired drafts, enforces the draft cap and picks an unused ID.
//
// The draft holds no letter content. Driver errors never leave this module:
// anything other than a `LetterStoreError` is replaced with a value-free error,
// so the server secret cannot reach a response or a log.
//
// This module must never be imported by browser code. The guard below throws if
// it is bundled into a client component, matching `clock.ts` and `store.ts`.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/letter-store/drafts.ts is server-only and must not be imported in the browser.",
  );
}

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { demoLetterDrafts, demoLetters, letters } from "@/lib/db/schema/letters";
import { encodeBase64url } from "@/lib/seal-format/base64url";
import { DRAFT_LIFETIME_MS } from "@/lib/seal-format/live-constants";
import {
  DRAFT_CAP,
  PREPARE_ID_ATTEMPTS,
  PREPARE_LOCK_KEY,
} from "@/lib/letter-store/live-constants";
import { LetterStoreError } from "@/lib/letter-store/store";

/** A prepared draft: the letter ID, its time-lock secret and the server clock read. */
export interface Draft {
  /** The 22-character letter ID. */
  letterId: string;
  /** The 32-byte per-letter time-lock secret. Never logged or returned to the client by this module. */
  serverSecret: Uint8Array;
  /** The database `clock_timestamp()` read in the same transaction; written as the draft's `created_at`. */
  serverNow: Date;
}

/** The default source of random bytes: the Web Crypto CSPRNG. */
function defaultRandomBytes(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

/**
 * Create a draft for a Live_Letter.
 *
 * In one transaction:
 * 1. Take the advisory lock `PREPARE_LOCK_KEY`.
 * 2. Read `clock_timestamp()` once; this is the server time `T`.
 * 3. Delete drafts created before `T - DRAFT_LIFETIME_MS`.
 * 4. Count the remaining drafts. More than `DRAFT_CAP` rejects with `busy`.
 * 5. Pick an ID up to `PREPARE_ID_ATTEMPTS` times, skipping any ID already used
 *    by a draft, a demo letter or a real letter.
 * 6. Insert the draft with `created_at = T`.
 *
 * @param randomBytes Source of random bytes, injectable for tests. It is called
 *   with 16 for an ID and 32 for the server secret.
 */
export async function createDraft(
  randomBytes: (n: number) => Uint8Array = defaultRandomBytes,
): Promise<Draft> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${PREPARE_LOCK_KEY})`);

      const [clock] = await tx.execute<{ t: Date }>(
        sql`SELECT clock_timestamp() AS t`,
      );
      const now = new Date(clock.t);

      await tx.execute(sql`
        DELETE FROM ${demoLetterDrafts}
        WHERE ${demoLetterDrafts.createdAt} < ${new Date(now.getTime() - DRAFT_LIFETIME_MS)}
      `);

      const [counted] = await tx.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM ${demoLetterDrafts}`,
      );
      if (counted.n > DRAFT_CAP) {
        throw new LetterStoreError("busy");
      }

      let id: string | undefined;
      for (let attempt = 0; attempt < PREPARE_ID_ATTEMPTS; attempt++) {
        const candidate = encodeBase64url(randomBytes(16));
        const taken = await tx.execute(sql`
          SELECT 1 AS present
          WHERE EXISTS (SELECT 1 FROM ${demoLetterDrafts} WHERE ${demoLetterDrafts.id} = ${candidate})
             OR EXISTS (SELECT 1 FROM ${demoLetters} WHERE ${demoLetters.id} = ${candidate})
             OR EXISTS (SELECT 1 FROM ${letters} WHERE ${letters.id} = ${candidate})
        `);
        if (taken.length === 0) {
          id = candidate;
          break;
        }
      }
      if (id === undefined) {
        throw new Error("The draft could not be created.");
      }

      const serverSecret = randomBytes(32);
      await tx.execute(sql`
        INSERT INTO ${demoLetterDrafts} (id, server_secret, created_at)
        VALUES (${id}, ${Buffer.from(serverSecret)}, ${now})
      `);

      return { letterId: id, serverSecret, serverNow: now };
    });
  } catch (error) {
    // Our own signals are re-raised unchanged. Every other error, including
    // driver errors whose detail can echo a stored value, is dropped and never
    // chained via `cause`.
    if (error instanceof LetterStoreError) {
      throw error;
    }
    throw new Error("The draft could not be created.");
  }
}
