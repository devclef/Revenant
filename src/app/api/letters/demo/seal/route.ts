// POST /api/letters/demo/seal — store a sealed Live_Letter and consume its Draft.
//
// The route runs the first six checks of the R4.1 table. `storeLiveLetter` runs
// steps 7 to 10 inside one transaction, because they need the database clock and
// the Draft lock. Checks stop at the first failure, so a later check never runs
// after an earlier one has failed:
//   1. Content-Length or body text over SEAL_BODY_MAX_CHARS -> 413 too_large
//   2. body is not JSON                                      -> 400 invalid_body
//   3. body fails the Zod shape                              -> 400 invalid_body
//   4. envelope fails parseEnvelope, or its letterId differs -> 400 invalid_envelope
//   5a. RP_ID unset or blank                                 -> 503 not_configured
//   5b. header rpId differs from RP_ID                       -> 400 invalid_envelope
//   6. envelope hash differs from the submitted hash         -> 400 hash_mismatch
//   7-10. storeLiveLetter: see `LetterStoreError` mapping below.
//
// Failure bodies are the frozen constants in `http.ts`. None of them echoes a
// submitted value. The route contains no SQL, imports nothing from
// `@/lib/crypto`, and never logs.

import { z } from "zod";
import { readRpId } from "@/lib/letter-store/config";
import {
  BUSY,
  HASH_MISMATCH,
  INTERNAL,
  INVALID_ENVELOPE,
  LOCK_OUT_OF_RANGE,
  NOT_CONFIGURED,
  NOT_FOUND,
  TOO_LARGE,
  invalidBody,
  json,
} from "@/lib/letter-store/http";
import { SEAL_BODY_MAX_CHARS } from "@/lib/letter-store/live-constants";
import { LetterStoreError, storeLiveLetter } from "@/lib/letter-store/store";
import { envelopeHash, parseEnvelope } from "@/lib/seal-format";

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

/** The HTTP status and fixed body for each store check (design Seal_Route). */
const STORE_ERROR_RESPONSE = {
  envelope: [400, INVALID_ENVELOPE],
  server_secret: [500, INTERNAL],
  hash_mismatch: [400, HASH_MISMATCH],
  duplicate_id: [404, NOT_FOUND],
  draft_not_found: [404, NOT_FOUND],
  busy: [429, BUSY],
  lock_out_of_range: [422, LOCK_OUT_OF_RANGE],
} as const;

/**
 * Seal a Live_Letter.
 *
 * @param request The incoming request. Its body is size-checked, parsed and
 *   validated before any database work.
 * @returns A JSON response per the design Routes table.
 */
export async function POST(request: Request): Promise<Response> {
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

    // (7-10) Draft, duplicate, cap and lock checks, then the insert.
    const stored = await storeLiveLetter({
      envelope,
      envelopeHash: submittedHash,
    });
    return json(201, {
      letterId: stored.letterId,
      sealedAt: stored.sealedAt.toISOString(),
      opensAt: stored.opensAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof LetterStoreError) {
      const [status, body] = STORE_ERROR_RESPONSE[error.check];
      return json(status, body);
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
