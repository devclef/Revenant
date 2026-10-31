// POST /api/openings — record an encrypted recall-answer record for a letter.
//
// After a letter opens, the browser asks the sealed recall questions and
// encrypts the answers in the browser, then posts the ciphertext here BEFORE
// the letter contents are shown (product "Recall first", R7). The server only
// ever stores ciphertext: it never decrypts, never reads the answers and never
// imports `@/lib/crypto`. The answer record lands in the append-only `openings`
// table, which no application code can later update or delete.
//
// Checks run STRICTLY in the design order, so a large or malformed request is
// rejected before any database work, and the existence of a letter is never
// revealed to a request that could not have been well-formed anyway:
//   1. too large (Content-Length or body text over 100,000 chars) -> 413
//   2. body is not JSON                                            -> 400
//   3. body fails the Zod shape/field constraints                 -> 400
//   4. ciphertext decodes to more than 65,536 bytes               -> 413
//   5. letterId malformed or unknown                              -> 404
//   6. letter not yet openable                                    -> 403
//   7. insert succeeds                                            -> 201
// Any unexpected throw becomes a fixed 500 with the error dropped (R8.6).
//
// Every response — success and error — carries `Cache-Control: no-store` via
// `http.ts`. A validation error names only the failing field, never echoing a
// submitted value (R8.3). Unknown keys in the body (e.g. a client-supplied
// `openedAt`) are stripped and ignored (R7.1): the recorded opening time is the
// database clock's.

import { z } from "zod";
import { findLetter, insertOpening } from "@/lib/letter-store/queries";
import { isOpenable } from "@/lib/letter-store/clock";
import {
  json,
  NOT_FOUND,
  INTERNAL,
  TOO_LARGE,
  invalidBody,
} from "@/lib/letter-store/http";
import { decodeBase64url, isLetterId } from "@/lib/seal-format";

// This route writes to the database and must reflect the server clock on every
// request: never statically cached, always run on the Node.js runtime.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The maximum accepted request size, applied to both the declared
// `Content-Length` and the decoded body text length (R-size). A sealed recall
// record is small; this is a defensive upper bound that rejects abuse before
// any JSON parse or database work.
const MAX_BODY_CHARS = 100_000;

// The maximum accepted ciphertext size in bytes. 65,536 is accepted; one more
// byte is rejected. This mirrors the `openings_ciphertext_len` CHECK so an
// oversized record is refused by the route with a clean 413 rather than a 500
// from the database constraint.
const MAX_CIPHERTEXT_BYTES = 65_536;

/**
 * The request body shape. A plain `z.object` strips unknown keys (so a client
 * `openedAt` is ignored, not rejected — R7.1). Both `ciphertext` and `nonce`
 * must be valid unpadded base64url; `nonce` must decode to exactly 12 bytes
 * (the AES-GCM nonce) and `ciphertext` to at least one byte. The upper
 * ciphertext bound is checked separately so it can return 413 rather than 400.
 */
const bodySchema = z.object({
  letterId: z.string(),
  ciphertext: z.string().refine(decodesToAtLeastOneByte, {
    message: "invalid base64url ciphertext",
  }),
  nonce: z.string().refine((s) => decodesToExactly(s, 12), {
    message: "invalid base64url nonce",
  }),
});

/**
 * Record an encrypted recall-answer record for a letter.
 *
 * @param request The incoming request. Its body is read as text, size-checked,
 *   then parsed as JSON and validated.
 * @returns A JSON response per the design Routes table.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // (1) Size: reject before reading or parsing anything larger than the
    // bound, using the declared Content-Length first (cheap) and the actual
    // body text length second (authoritative).
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_CHARS) {
      return json(413, TOO_LARGE);
    }

    const bodyText = await request.text();
    if (bodyText.length > MAX_BODY_CHARS) {
      return json(413, TOO_LARGE);
    }

    // (2) JSON: a body that is not valid JSON is a bad request.
    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return json(400, invalidBody("body"));
    }

    // (3) Shape and field constraints. On failure, name only the first failing
    // field's path, never echoing any submitted value (R8.3).
    const result = bodySchema.safeParse(parsed);
    if (!result.success) {
      const field = firstIssueField(result.error);
      return json(400, invalidBody(field));
    }
    const { letterId, ciphertext, nonce } = result.data;

    // (4) Oversized ciphertext -> 413 (65,536 bytes accepted, one more
    // rejected). Decoding here cannot throw: the schema already validated the
    // base64url above.
    const ciphertextBytes = decodeBase64url(ciphertext);
    if (ciphertextBytes.length > MAX_CIPHERTEXT_BYTES) {
      return json(413, TOO_LARGE);
    }

    // (5) Letter ID: a malformed ID returns the same 404 body as an unknown
    // one, so the two are indistinguishable (Property 17).
    if (!isLetterId(letterId)) {
      return json(404, NOT_FOUND);
    }
    const row = await findLetter(letterId);
    if (row === null) {
      return json(404, NOT_FOUND);
    }

    // (6) Not yet openable: never record an opening before the opening date.
    // Reveal only the opening instant so the caller can show a countdown.
    if (!isOpenable(row.opensAt, row.dbNow)) {
      return json(403, { opensAt: row.opensAt.toISOString() });
    }

    // (7) Append the encrypted record. `opened_at` is the database default, so
    // the recorded time is the server clock's, never the client's.
    const nonceBytes = decodeBase64url(nonce);
    const { openingId, openedAt } = await insertOpening({
      letterId: row.id,
      demo: row.demo,
      ciphertext: Buffer.from(ciphertextBytes),
      nonce: Buffer.from(nonceBytes),
    });

    return json(201, {
      openingId,
      openedAt: openedAt.toISOString(),
    });
  } catch {
    // Any failure — a driver error, a decode surprise, anything — becomes a
    // fixed, value-free 500. The error is dropped, never logged or chained, so
    // nothing request- or row-derived can leak (R8.6).
    return json(500, INTERNAL);
  }
}

/** True when `s` is valid unpadded base64url decoding to at least one byte. */
function decodesToAtLeastOneByte(s: string): boolean {
  try {
    return decodeBase64url(s).length >= 1;
  } catch {
    return false;
  }
}

/** True when `s` is valid unpadded base64url decoding to exactly `n` bytes. */
function decodesToExactly(s: string, n: number): boolean {
  try {
    decodeBase64url(s, n);
    return true;
  } catch {
    return false;
  }
}

/**
 * The name of the first failing field in a Zod error, for the `invalid_body`
 * response. Uses the first issue's path head (e.g. `nonce`), falling back to
 * `body` when the issue has no path (a top-level type or unknown-key error). No
 * submitted value is read, so nothing can be echoed back (R8.3).
 */
function firstIssueField(error: z.ZodError): string {
  const first = error.issues[0];
  const head = first?.path[0];
  return typeof head === "string" || typeof head === "number"
    ? String(head)
    : "body";
}
