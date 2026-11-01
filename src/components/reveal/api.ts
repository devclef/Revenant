/**
 * Client-side wrapper over the three spec 02 letter routes the Opening_Flow
 * needs: `GET /api/letters/{id}`, `GET /api/letters/{id}/secret` and
 * `POST /api/openings`. The effect runner (`useOpeningFlow.ts`) calls these and
 * turns each outcome into a `FlowEvent`; this module never touches the reducer,
 * the DOM, crypto or storage.
 *
 * Every request:
 * - uses only the fixed relative URL for its route, so the browser talks only
 *   to Revenant's own origin and never to anything a letter might name;
 * - sends `cache: "no-store"` (a released secret or letter status must never be
 *   cached), `credentials: "same-origin"` and `referrerPolicy: "no-referrer"`
 *   (R7.4, R14.4), carrying no cookies cross-origin and leaking no referrer;
 * - carries no field other than those the route defines. `postOpening` sends
 *   exactly `{ letterId, ciphertext, nonce }` and nothing else.
 *
 * Each response body is validated against a small local Zod schema matching the
 * spec 02 route shape. A body that does not match the expected shape is treated
 * as `unreachable`, exactly like a network error or a 5xx, so a malformed body
 * never reaches `openLetter` (design Error Handling: "Doesn't match the
 * expected shape -> Treated as `unreachable`"). The wrapper never throws for a
 * failed request: a thrown `fetch` (offline, DNS, abort) is caught and mapped
 * to `unreachable` as well.
 *
 * Status mapping follows design.md "Error Handling":
 *   getLetter:  200 sealed -> `sealed`; 200 openable -> `openable`;
 *               404 -> `not_placed`; network/5xx/other 4xx/bad body ->
 *               `unreachable`.
 *   getSecret:  200 -> `ok`; 403 -> `forbidden` (with its `opensAt`);
 *               network/5xx/other 4xx/bad body -> `unreachable`.
 *   postOpening: 201 -> `ok`; anything else (including a thrown fetch) ->
 *               `failed`, so the answers are kept and the same bytes can be
 *               retried (R8.7).
 *
 * No `console.*` and no storage are used here; the flow never logs (R8.6, and
 * the source-scan test that bans `console` in `src/components/reveal/**`).
 */

import { z } from "zod";

/** The fixed relative route URLs. No origin, no query, no interpolation beyond
 * the letter ID the caller passes. */
function letterUrl(id: string): string {
  return `/api/letters/${id}`;
}
function secretUrl(id: string): string {
  return `/api/letters/${id}/secret`;
}
const OPENINGS_URL = "/api/openings";

/** The request options every call shares (R7.4, R14.4). */
const BASE_INIT = {
  cache: "no-store",
  credentials: "same-origin",
  referrerPolicy: "no-referrer",
} as const satisfies RequestInit;

// --- Response schemas (spec 02 route shapes) --------------------------------
//
// Each schema is deliberately narrow: it names only the fields the flow reads,
// and `GET /api/letters/{id}` is a discriminated union on `status` so a sealed
// body can never be read as an openable one. Unknown extra keys are ignored by
// a plain `z.object`, which is fine — the flow reads only the named fields —
// but a missing or wrong-typed named field fails the parse and the call maps to
// `unreachable`.

const letterSealedSchema = z.object({
  status: z.literal("sealed"),
  opensAt: z.string(),
});

const letterOpenableSchema = z.object({
  status: z.literal("openable"),
  envelope: z.unknown(),
  envelopeHash: z.string(),
});

const letterBodySchema = z.discriminatedUnion("status", [
  letterSealedSchema,
  letterOpenableSchema,
]);

const secretOkSchema = z.object({
  serverSecret: z.string(),
});

const secretForbiddenSchema = z.object({
  opensAt: z.string(),
});

// --- getLetter --------------------------------------------------------------

/** The outcome of reading a letter's public status. */
export type GetLetterResult =
  | { outcome: "sealed"; opensAt: string }
  | { outcome: "openable"; envelope: unknown; envelopeHash: string }
  | { outcome: "not_placed" }
  | { outcome: "unreachable" };

/**
 * Read a letter's public status.
 *
 * - 200 with a well-formed `sealed` body -> `sealed`.
 * - 200 with a well-formed `openable` body -> `openable`.
 * - 404 -> `not_placed` (the demo letter has not been placed yet).
 * - A network error, 5xx, any other non-200 status, or a 200 body that does not
 *   match the schema -> `unreachable`.
 */
export async function getLetter(id: string): Promise<GetLetterResult> {
  let response: Response;
  try {
    response = await fetch(letterUrl(id), BASE_INIT);
  } catch {
    return { outcome: "unreachable" };
  }

  if (response.status === 404) {
    return { outcome: "not_placed" };
  }
  if (response.status !== 200) {
    // 5xx and any other 4xx are indistinguishable to the flow: unreachable.
    return { outcome: "unreachable" };
  }

  const body = await readJson(response);
  const parsed = letterBodySchema.safeParse(body);
  if (!parsed.success) {
    // A malformed body is treated exactly like a network error, so it never
    // reaches `openLetter`.
    return { outcome: "unreachable" };
  }

  if (parsed.data.status === "sealed") {
    return { outcome: "sealed", opensAt: parsed.data.opensAt };
  }
  return {
    outcome: "openable",
    envelope: parsed.data.envelope,
    envelopeHash: parsed.data.envelopeHash,
  };
}

// --- getSecret --------------------------------------------------------------

/** The outcome of requesting a letter's time-lock server secret. */
export type GetSecretResult =
  | { outcome: "ok"; serverSecret: string }
  | { outcome: "forbidden"; opensAt: string }
  | { outcome: "unreachable" };

/**
 * Request a letter's time-lock server secret.
 *
 * - 200 with a well-formed body -> `ok` with the base64url `serverSecret`.
 * - 403 with a well-formed body -> `forbidden` with the returned `opensAt`
 *   (the letter is not open yet; the flow falls back to the sealed countdown).
 * - A 403 whose body does not match, a network error, 5xx, any other non-200
 *   status, or a 200 body that does not match -> `unreachable`.
 */
export async function getSecret(id: string): Promise<GetSecretResult> {
  let response: Response;
  try {
    response = await fetch(secretUrl(id), BASE_INIT);
  } catch {
    return { outcome: "unreachable" };
  }

  if (response.status === 403) {
    const body = await readJson(response);
    const parsed = secretForbiddenSchema.safeParse(body);
    if (!parsed.success) {
      return { outcome: "unreachable" };
    }
    return { outcome: "forbidden", opensAt: parsed.data.opensAt };
  }

  if (response.status !== 200) {
    return { outcome: "unreachable" };
  }

  const body = await readJson(response);
  const parsed = secretOkSchema.safeParse(body);
  if (!parsed.success) {
    return { outcome: "unreachable" };
  }
  return { outcome: "ok", serverSecret: parsed.data.serverSecret };
}

// --- postOpening ------------------------------------------------------------

/** The body of a `POST /api/openings` request: exactly these three fields. */
export type OpeningBody = {
  letterId: string;
  ciphertext: string;
  nonce: string;
};

/** The outcome of recording an encrypted recall record. */
export type PostOpeningResult = { outcome: "ok" } | { outcome: "failed" };

/**
 * Record an encrypted recall-answer record for a letter.
 *
 * The request body carries exactly `{ letterId, ciphertext, nonce }` and
 * nothing else (no `openedAt`, no client clock — the server records its own).
 *
 * - 201 -> `ok`.
 * - Anything else, including a thrown `fetch` -> `failed`. The caller keeps the
 *   sealed record so the same bytes can be posted again on retry (R8.7).
 */
export async function postOpening(
  body: OpeningBody,
): Promise<PostOpeningResult> {
  // Reconstruct the body from exactly the three named fields, so no extra key a
  // caller might pass is ever sent on the wire.
  const payload: OpeningBody = {
    letterId: body.letterId,
    ciphertext: body.ciphertext,
    nonce: body.nonce,
  };

  let response: Response;
  try {
    response = await fetch(OPENINGS_URL, {
      ...BASE_INIT,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { outcome: "failed" };
  }

  return response.status === 201 ? { outcome: "ok" } : { outcome: "failed" };
}

// --- helpers ----------------------------------------------------------------

/**
 * Read a response body as JSON, returning `undefined` when the body is not JSON
 * at all. A `undefined` result fails every schema above, so a non-JSON body is
 * treated as a malformed body (`unreachable`/`failed`), never thrown.
 */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
