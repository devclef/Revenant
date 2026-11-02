// Client wrapper over the two Live_Letter sealing routes (spec 06-lock-and-unlock,
// design.md "Seal_Page" and R15.4): the Prepare_Route and the Seal_Route.
//
// Every request:
// - uses one of two fixed relative paths, so the browser talks only to
//   Revenant's own origin;
// - sends `cache: "no-store"`, `credentials: "same-origin"` and
//   `referrerPolicy: "no-referrer"`;
// - carries only the fields the route defines.
//
// Response bodies are checked with small Zod schemas. A body that does not
// match is `server`. Neither function throws: a thrown fetch (offline, DNS,
// abort) is `network`. No logging and no storage (R19, R15.4).

import { z } from "zod";

export const PREPARE_PATH = "/api/letters/demo/prepare";
export const SEAL_PATH = "/api/letters/demo/seal";

const BASE_INIT = {
  cache: "no-store",
  credentials: "same-origin",
  referrerPolicy: "no-referrer",
} as const satisfies RequestInit;

export type PrepareResult =
  | { ok: true; letterId: string; serverSecret: string; serverNow: string }
  | { ok: false; kind: "busy" | "not_configured" | "server" | "network" };

export type SealPostResult =
  | { ok: true; letterId: string; sealedAt: string; opensAt: string }
  | { ok: false; kind: "busy" | "clock" | "not_found" | "invalid" | "server" | "network" };

export interface SealApi {
  prepare(): Promise<PrepareResult>;
  seal(body: { letterId: string; envelope: unknown; envelopeHash: string }): Promise<SealPostResult>;
}

const prepareBodySchema = z.object({
  letterId: z.string(),
  serverSecret: z.string(),
  serverNow: z.string(),
});

const sealBodySchema = z.object({
  letterId: z.string(),
  sealedAt: z.string(),
  opensAt: z.string(),
});

/** Reads the JSON body, or `undefined` when it is not JSON at all. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** POST the prepare route. Never throws. */
export async function prepareLetter(): Promise<PrepareResult> {
  let response: Response;
  try {
    response = await fetch(PREPARE_PATH, { ...BASE_INIT, method: "POST" });
  } catch {
    return { ok: false, kind: "network" };
  }

  if (response.status === 429) return { ok: false, kind: "busy" };
  if (response.status === 503) return { ok: false, kind: "not_configured" };
  if (response.status !== 201) return { ok: false, kind: "server" };

  const parsed = prepareBodySchema.safeParse(await readJson(response));
  if (!parsed.success) return { ok: false, kind: "server" };
  return { ok: true, ...parsed.data };
}

/** POST the seal route with exactly `{ letterId, envelope, envelopeHash }`. Never throws. */
export async function postSeal(body: {
  letterId: string;
  envelope: unknown;
  envelopeHash: string;
}): Promise<SealPostResult> {
  let response: Response;
  try {
    response = await fetch(SEAL_PATH, {
      ...BASE_INIT,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        letterId: body.letterId,
        envelope: body.envelope,
        envelopeHash: body.envelopeHash,
      }),
    });
  } catch {
    return { ok: false, kind: "network" };
  }

  if (response.status === 201) {
    const parsed = sealBodySchema.safeParse(await readJson(response));
    if (!parsed.success) return { ok: false, kind: "server" };
    return { ok: true, ...parsed.data };
  }
  if (response.status === 429) return { ok: false, kind: "busy" };
  if (response.status === 422) return { ok: false, kind: "clock" };
  if (response.status === 404) return { ok: false, kind: "not_found" };
  if (response.status === 400) return { ok: false, kind: "invalid" };
  return { ok: false, kind: "server" };
}

/**
 * The real API. The fetch global is read on every call, not captured at load,
 * so a replacement installed after import (the QA stub) is the one used.
 */
export const realSealApi: SealApi = {
  prepare: () => prepareLetter(),
  seal: (body) => postSeal(body),
};
