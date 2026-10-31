// GET /api/letters/[id]/secret — release a letter's time-lock server secret.
//
// The per-letter `serverSecret` is one of the two factors (with the user's
// passkey/backup key) that unwrap the content key, so releasing it before the
// opening date would let the letter be opened early. The server is the sole
// holder of the authoritative clock: it hands the secret back ONLY when the
// database `now()` is at or after `opens_at` (R6.4, R6.5). The client clock
// never decides.
//
// The open/sealed decision is made with the pure `isOpenable` against the
// database `now()` read in the same statement as the row (R6.4), never a
// client-supplied time. Equal-to-the-millisecond counts as open (R6.5).
//
// Every response — success and error — carries `Cache-Control: no-store` via
// `http.ts` (R6.10): the secret must never be cached by any proxy or browser.
// Malformed and unknown IDs return the byte-identical `not_found` 404 so the
// two are indistinguishable (Property 17). The whole handler is wrapped so any
// unexpected failure becomes a fixed 500 with the error dropped, never logged
// or chained (R8.6).
//
// The secret is the raw 32 time-lock bytes, encoded with the seal-format
// unpadded base64url codec (43 chars). This route reads no key material and
// never imports `@/lib/crypto`.

import { findLetter } from "@/lib/letter-store/queries";
import { isOpenable } from "@/lib/letter-store/clock";
import { json, NOT_FOUND, INTERNAL } from "@/lib/letter-store/http";
import { encodeBase64url, isLetterId } from "@/lib/seal-format";

// This route reads the database and must reflect the server clock on every
// request: never statically cached, always run on the Node.js runtime.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Release a letter's time-lock server secret, but only at or after its opening
 * date.
 *
 * @param _request The incoming request (unused; the body is never read).
 * @param ctx Route context. In Next 15 `params` is a Promise that must be
 *   awaited.
 * @returns A JSON response per the design Routes table.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;

    // Malformed IDs are rejected before any query, and return the same body as
    // an unknown ID so the two cannot be told apart.
    if (!isLetterId(id)) {
      return json(404, NOT_FOUND);
    }

    const row = await findLetter(id);
    if (row === null) {
      return json(404, NOT_FOUND);
    }

    if (!isOpenable(row.opensAt, row.dbNow)) {
      // Still sealed: never release the secret. Reveal only the opening instant
      // so the caller can show a countdown, nothing else.
      return json(403, { opensAt: row.opensAt.toISOString() });
    }

    // Openable: hand back the 32-byte time-lock secret as 43 base64url chars.
    // `serverSecret` is server-origin bytes, never client input.
    return json(200, {
      serverSecret: encodeBase64url(new Uint8Array(row.serverSecret)),
    });
  } catch {
    // Any failure — a driver error, a malformed stored secret, anything —
    // becomes a fixed, value-free 500. The error is dropped, never logged or
    // chained, so nothing request- or row-derived can leak (R8.6).
    return json(500, INTERNAL);
  }
}
