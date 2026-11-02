// POST /api/letters/demo/prepare — issue a Draft for a Live_Letter.
//
// The route returns the new letter ID, the 32-byte time-lock `serverSecret` and
// the database clock read taken with the Draft. The browser uses `serverNow`
// only to set `sealedAt` and `opensAt` near the server clock. The Seal_Route
// decides the lock, so this route never sets a time itself.
//
// Checks, in order:
//   1. `RP_ID` unset or blank        -> 503 not_configured, no database call
//   2. draft cap reached             -> 429 busy
//   3. any other failure             -> 500 internal
//   4. success                       -> 201 {letterId, serverSecret, serverNow}
//
// The request body is never read (R3.4). Every response carries
// `Cache-Control: no-store` via `http.ts`. This route never logs: the server
// secret must not reach a response or a log (R3.9), so a failure is reported
// only as its fixed body.

import { createDraft } from "@/lib/letter-store/drafts";
import { readRpId } from "@/lib/letter-store/config";
import { BUSY, INTERNAL, NOT_CONFIGURED, json } from "@/lib/letter-store/http";
import { LetterStoreError } from "@/lib/letter-store/store";
import { encodeBase64url } from "@/lib/seal-format";

// This route writes to the database and must reflect the server clock on every
// request: never statically cached, always run on the Node.js runtime.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Issue a Draft for a Live_Letter.
 *
 * @param _request The incoming request. Its body is ignored and never read.
 * @returns A JSON response per the design Routes table.
 */
// The request is accepted to match the route signature, and is never read.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: Request): Promise<Response> {
  if (readRpId() === null) {
    return json(503, NOT_CONFIGURED);
  }

  try {
    const draft = await createDraft();
    return json(201, {
      letterId: draft.letterId,
      serverSecret: encodeBase64url(draft.serverSecret),
      serverNow: draft.serverNow.toISOString(),
    });
  } catch (error) {
    // The draft cap is the only check with its own status. Every other error,
    // including a driver failure, becomes the fixed 500 body. The error itself
    // is dropped: nothing is logged and nothing is returned.
    if (error instanceof LetterStoreError && error.check === "busy") {
      return json(429, BUSY);
    }
    return json(500, INTERNAL);
  }
}
