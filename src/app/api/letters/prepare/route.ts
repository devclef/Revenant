// POST /api/letters/prepare — issue a Draft for a real letter.
//
// Same contract as the Live_Letter prepare route, but the Draft is written to
// `letter_drafts`. Checks, in order:
//   1. REAL_SEALING is not exactly "on"  -> 404 real_sealing_off, nothing stored
//   2. `RP_ID` unset or blank            -> 503 not_configured, no database call
//   3. draft cap reached                 -> 429 busy
//   4. any other failure                 -> 500 internal
//   5. success                           -> 201 {letterId, serverSecret, serverNow}
//
// The request body is never read. This route never logs: the server secret must
// not reach a response or a log.

import { realSealingOn } from "@/lib/feature-flags";
import { letterDrafts } from "@/lib/db/schema/letters";
import { readRpId } from "@/lib/letter-store/config";
import { createDraft } from "@/lib/letter-store/drafts";
import {
  BUSY,
  INTERNAL,
  NOT_CONFIGURED,
  REAL_SEALING_OFF,
  json,
} from "@/lib/letter-store/http";
import { LetterStoreError } from "@/lib/letter-store/store";
import { encodeBase64url } from "@/lib/seal-format";

// This route writes to the database and must reflect the server clock on every
// request: never statically cached, always run on the Node.js runtime.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Issue a Draft for a real letter.
 *
 * @param _request The incoming request. Its body is ignored and never read.
 * @returns A JSON response per the design Routes table.
 */
// The request is accepted to match the route signature, and is never read.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: Request): Promise<Response> {
  if (!realSealingOn()) {
    return json(404, REAL_SEALING_OFF);
  }
  if (readRpId() === null) {
    return json(503, NOT_CONFIGURED);
  }

  try {
    const draft = await createDraft(undefined, letterDrafts);
    return json(201, {
      letterId: draft.letterId,
      serverSecret: encodeBase64url(draft.serverSecret),
      serverNow: draft.serverNow.toISOString(),
    });
  } catch (error) {
    // Only the draft cap has its own status. Everything else, including a driver
    // failure, becomes the fixed 500 body and is dropped without logging.
    if (error instanceof LetterStoreError && error.check === "busy") {
      return json(429, BUSY);
    }
    return json(500, INTERNAL);
  }
}
