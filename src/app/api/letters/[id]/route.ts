// GET /api/letters/[id] — read a letter's public status.
//
// Before its opening date a letter returns only a "sealed" status and the
// opening instant, so a QR scan before `opens_at` reveals nothing about the
// contents (R6.1, product "Wait"). At or after the opening date it returns the
// sealed envelope and its hash, which the browser decrypts and verifies; the
// server never decrypts and never imports `@/lib/crypto`.
//
// The open/sealed decision is made with the pure `isOpenable` against the
// database `now()` read in the same statement as the row (R6.4, R6.5), never a
// client-supplied time.
//
// Every response — success and error — carries `Cache-Control: no-store` via
// `http.ts` (R6.10). Malformed and unknown IDs return the byte-identical
// `not_found` 404 so the two are indistinguishable (Property 17). The whole
// handler is wrapped so any unexpected failure becomes a fixed 500 with the
// error dropped, never logged or chained (R8.6).

import { findLetter } from "@/lib/letter-store/queries";
import { isOpenable } from "@/lib/letter-store/clock";
import { json, NOT_FOUND, INTERNAL } from "@/lib/letter-store/http";
import { isLetterId } from "@/lib/seal-format";

// This route reads the database and must reflect the server clock on every
// request: never statically cached, always run on the Node.js runtime.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Read a letter's public status.
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

    // `opensAt` is always the millisecond-precision UTC ISO form.
    const opensAt = row.opensAt.toISOString();

    if (!isOpenable(row.opensAt, row.dbNow)) {
      // Still sealed: reveal only the status, opening instant and demo flag.
      return json(200, {
        status: "sealed",
        opensAt,
        demo: row.demo,
      });
    }

    // Openable: hand back the sealed envelope and its hash for the browser to
    // decrypt and verify. `envelope` is the stored canonical JSON parsed back
    // to its values (R6.2); the server never interprets it.
    return json(200, {
      status: "openable",
      opensAt,
      demo: row.demo,
      envelope: JSON.parse(row.envelope),
      envelopeHash: row.envelopeHash,
    });
  } catch {
    // Any failure — a malformed stored envelope, a driver error, anything —
    // becomes a fixed, value-free 500. The error is dropped, never logged or
    // chained, so nothing request- or row-derived can leak (R8.6).
    return json(500, INTERNAL);
  }
}
