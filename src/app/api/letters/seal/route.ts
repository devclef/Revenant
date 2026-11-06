// POST /api/letters/seal — store a sealed real letter and consume its draft.
//
// Checks stop at the first failure, in this order:
//   0.  REAL_SEALING is not exactly "on"                       -> 404 real_sealing_off
//   1.  Content-Length or body text over SEAL_BODY_MAX_CHARS   -> 413 too_large
//   2.  body is not JSON                                       -> 400 invalid_body
//   3.  body fails the Zod shape                               -> 400 invalid_body
//   4.  envelope fails parseEnvelope, or its letterId differs -> 400 invalid_envelope
//   5a. RP_ID unset or blank                                   -> 503 not_configured
//   5b. header rpId differs from RP_ID                         -> 400 invalid_envelope
//   6.  envelope hash differs from the submitted hash          -> 400 hash_mismatch
//   7.  opens_at is earlier than three calendar months after the server clock
//                                                              -> 422 opens_at_too_early
//   8-9. storeRealLetter: draft, duplicate and insert checks (see STORE_ERROR_RESPONSE).
//
// Check 7 runs here against `Date.now()`, so the route refuses early without a
// database call. `storeRealLetter` repeats the lock check against the database
// clock inside its transaction, which is the authoritative one. The route sets
// no time itself: `sealed_at` comes from the store, and `opens_at` is the only
// time value read from the request.
//
// Failure bodies are the frozen constants in `http.ts`. None echoes a submitted
// value. This route imports nothing from `@/lib/crypto` and never logs.

import { z } from "zod";
import { realSealingOn } from "@/lib/feature-flags";
import { readRpId } from "@/lib/letter-store/config";
import {
  HASH_MISMATCH,
  INTERNAL,
  INVALID_ENVELOPE,
  NOT_CONFIGURED,
  NOT_FOUND,
  OPENS_AT_TOO_EARLY,
  REAL_SEALING_OFF,
  TOO_LARGE,
  invalidBody,
  json,
} from "@/lib/letter-store/http";
import { SEAL_BODY_MAX_CHARS } from "@/lib/letter-store/live-constants";
import { storeRealLetter } from "@/lib/letter-store/real";
import {
  LetterStoreError,
  type LetterStoreCheck,
} from "@/lib/letter-store/store";
import { envelopeHash, meetsRealLock, parseEnvelope } from "@/lib/seal-format";

// This route writes to the database and must reflect the server clock on every
// request: never statically cached, always run on the Node.js runtime.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The request body. A plain `z.object` strips unknown keys before any check. */
const bodySchema = z.object({
  letterId: z.string(),
  envelope: z.record(z.string(), z.unknown()),
  envelopeHash: z.string(),
});

/** The HTTP status and fixed body for each store check a real seal can fail. */
const STORE_ERROR_RESPONSE: Partial<
  Record<LetterStoreCheck, readonly [number, object]>
> = {
  envelope: [400, INVALID_ENVELOPE],
  hash_mismatch: [400, HASH_MISMATCH],
  duplicate_id: [404, NOT_FOUND],
  draft_not_found: [404, NOT_FOUND],
  opens_at_too_early: [422, OPENS_AT_TOO_EARLY],
};

/**
 * Seal a real letter.
 *
 * @param request The incoming request. Its body is size-checked, parsed and
 *   validated before any database work.
 * @returns A JSON response: 201 with the stored header fields on success.
 */
export async function POST(request: Request): Promise<Response> {
  if (!realSealingOn()) {
    return json(404, REAL_SEALING_OFF);
  }

  try {
    // (1) Size, checked on the declared length first and the body text second.
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > SEAL_BODY_MAX_CHARS) {
      return json(413, TOO_LARGE);
    }
    const bodyText = await request.text();
    if (bodyText.length > SEAL_BODY_MAX_CHARS) {
      return json(413, TOO_LARGE);
    }

    // (2) JSON.
    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return json(400, invalidBody("body"));
    }

    // (3) Shape. Only the first failing field's name is returned.
    const result = bodySchema.safeParse(parsed);
    if (!result.success) {
      return json(400, invalidBody(firstIssueField(result.error)));
    }
    const { letterId, envelope, envelopeHash: submittedHash } = result.data;

    // (4) The envelope must parse, and must name the same letter as the body.
    const header = parseEnvelope(envelope);
    if (!header.ok || header.value.letterId !== letterId) {
      return json(400, INVALID_ENVELOPE);
    }

    // (5a) The passkey relying-party ID must be configured.
    const configuredRpId = readRpId();
    if (configuredRpId === null) {
      return json(503, NOT_CONFIGURED);
    }

    // (5b) A passkey-wrapped envelope must name this server's RP_ID.
    if (header.value.rpId !== undefined && header.value.rpId !== configuredRpId) {
      return json(400, INVALID_ENVELOPE);
    }

    // (6) The submitted hash must match the envelope.
    if ((await envelopeHash(envelope)) !== submittedHash) {
      return json(400, HASH_MISMATCH);
    }

    // (7) The lock: opens_at must be at least three calendar months after now.
    const opensAtMs = new Date(header.value.opensAt).getTime();
    if (!meetsRealLock(opensAtMs, Date.now())) {
      return json(422, OPENS_AT_TOO_EARLY);
    }

    // (8-9) Draft, duplicate and insert checks, then the write.
    const stored = await storeRealLetter({
      envelope,
      envelopeHash: submittedHash,
    });
    // Check (6) proved the recomputed hash equals `submittedHash`, so that is the
    // stored value.
    return json(201, {
      letterId: stored.letterId,
      sealedAt: stored.sealedAt.toISOString(),
      opensAt: stored.opensAt.toISOString(),
      envelopeHash: submittedHash,
    });
  } catch (error) {
    if (error instanceof LetterStoreError) {
      const mapped = STORE_ERROR_RESPONSE[error.check];
      if (mapped) {
        return json(mapped[0], mapped[1]);
      }
    }
    // Any other failure is dropped and answered with the fixed 500 body.
    return json(500, INTERNAL);
  }
}

/**
 * The name of the first failing field in a Zod error, for `invalid_body`. No
 * submitted value is read, so nothing is echoed back.
 */
function firstIssueField(error: z.ZodError): string {
  const head = error.issues[0]?.path[0];
  return typeof head === "string" || typeof head === "number"
    ? String(head)
    : "body";
}
