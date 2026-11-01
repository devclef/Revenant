// Server-only HTTP response helpers for the letter routes.
//
// Every response the letter, secret and openings routes return goes through
// `json`, so `Cache-Control: no-store` is set uniformly on success AND error
// responses (R6.10, R7.5). A sealed letter must never be cached by any proxy or
// browser, and the countdown/"still sealed" body must never be served stale.
//
// The fixed error bodies below are the single source of truth for every error
// the routes return. Reusing the same frozen constant everywhere guarantees the
// bodies are byte-identical wherever they appear: a malformed ID and an unknown
// ID both return the exact same `not_found` body and headers, so the two are
// indistinguishable to a caller (Property 17).
//
// Import boundary: this module imports only `next/server`. It never imports
// `@/lib/crypto`; it holds no key material and performs no cryptography. The
// `crypto.md` import-boundary test enforces this. No `console.*` calls anywhere:
// routes must not log request-derived data (R8.6).
//
// This module must never be imported by browser code. The guard below throws if
// it is bundled into a client component, matching `clock.ts` and `store.ts`.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/letter-store/http.ts is server-only and must not be imported in the browser.",
  );
}

import { NextResponse } from "next/server";

/**
 * Build a JSON response with `Cache-Control: no-store` on every response,
 * errors included (R6.10, R7.5).
 *
 * This is the only way the letter routes emit a response, so the no-store
 * header is applied uniformly and cannot be forgotten on an error path.
 *
 * @param status HTTP status code.
 * @param body JSON-serialisable response body.
 * @returns A `NextResponse` with the body as JSON and `Cache-Control: no-store`.
 */
export function json(status: number, body: unknown): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Fixed error body: resource not found.
 *
 * Returned for both malformed and unknown letter IDs so the two are
 * indistinguishable (Property 17). Frozen so it cannot be mutated in place and
 * is byte-identical wherever reused.
 */
export const NOT_FOUND = Object.freeze({ error: "not_found" } as const);

/** Fixed error body: an unexpected server-side failure (R-internal). */
export const INTERNAL = Object.freeze({ error: "internal" } as const);

/** Fixed error body: the request payload exceeded the allowed size (R-size). */
export const TOO_LARGE = Object.freeze({ error: "too_large" } as const);

/** Fixed error body: the Live_Letter demo is busy (429). Nothing was sealed. */
export const BUSY = Object.freeze({ error: "busy" } as const);

/** Fixed error body: the Live_Letter demo is not configured on this server (503). */
export const NOT_CONFIGURED = Object.freeze({ error: "not_configured" } as const);

/** Fixed error body: the sealed envelope did not parse as a valid letter (400). */
export const INVALID_ENVELOPE = Object.freeze({ error: "invalid_envelope" } as const);

/** Fixed error body: the submitted envelope hash does not match the envelope (400). */
export const HASH_MISMATCH = Object.freeze({ error: "hash_mismatch" } as const);

/** Fixed error body: the envelope's lock does not fit the server clock (422). */
export const LOCK_OUT_OF_RANGE = Object.freeze({ error: "lock_out_of_range" } as const);

/**
 * Build the fixed `invalid_body` error body for a named field (400).
 *
 * The `field` names which part of the request body failed validation. The
 * shape is fixed; only the field name varies.
 *
 * @param field The name of the invalid field.
 * @returns A frozen `invalid_body` error body carrying the field name.
 */
export function invalidBody(field: string) {
  return Object.freeze({ error: "invalid_body", field } as const);
}
