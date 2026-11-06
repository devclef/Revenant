// The Passkey_Module: creates a passkey and runs the PRF check (crypto.md,
// design.md "Authenticator_Port and Passkey_Module", requirements R7).
//
// Each function takes an Authenticator_Port, so tests pass the fake. The port
// call is the first asynchronous operation of each function: everything before
// it is synchronous, so a click handler that calls a function without `await`
// starts the WebAuthn prompt in the same tick (the first-async-step rule).
//
// No function throws for an expected failure, logs, stores, or returns the PRF
// output on failure. Nothing here learns support from the user agent; the
// result of the PRF check decides.

import { PortError } from "./authenticator-port";
import type {
  AuthenticatorPort,
  PortCreateOptions,
  PortGetOptions,
  PortResult,
} from "./authenticator-port";

// --- Constants (design.md "Constants") ---------------------------------------

export const PASSKEY_RP_NAME = "Revenant";
export const PASSKEY_USER_NAME = "Revenant demo";
export const PASSKEY_USER_DISPLAY_NAME = "Revenant demo";
export const PASSKEY_TIMEOUT_MS = 120_000;
export const PASSKEY_PUBKEY_ALGS: readonly number[] = [-7, -257];
export const PRF_SALT_BYTES = 32;
export const PRF_OUTPUT_BYTES = 32;
export const CHALLENGE_BYTES = 32;
export const USER_ID_BYTES = 16;
export const CREDENTIAL_ID_MAX_BYTES = 1023;

// --- Result types (design.md) ------------------------------------------------

export type CreatePasskeyResult =
  | {
      ok: true;
      credentialId: Uint8Array;
      prfSalt: Uint8Array;
      createdPrf: Uint8Array | null;
    }
  | { ok: false; reason: "unsupported" | "cancelled" | "failed" };

export type ConfirmPasskeyResult =
  | {
      ok: true;
      credentialId: Uint8Array;
      prfSalt: Uint8Array;
      prfOutput: Uint8Array;
    }
  | { ok: false; reason: "cancelled" | "no_prf" | "prf_mismatch" | "failed" };

export type AssertPasskeyResult =
  | { ok: true; prfOutput: Uint8Array }
  | {
      ok: false;
      reason: "unsupported" | "cancelled" | "no_prf" | "wrong_domain" | "failed";
    };

// --- Helpers -----------------------------------------------------------------

/** Fresh random bytes from WebCrypto. Synchronous. */
function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function pubKeyCredParams(): PortCreateOptions["pubKeyCredParams"] {
  return PASSKEY_PUBKEY_ALGS.map((alg) => ({
    type: "public-key" as const,
    alg,
  }));
}

/** The port's own cancel kind maps to `cancelled`; anything else is `failed`. */
function portErrorReason(error: unknown): "cancelled" | "failed" {
  return error instanceof PortError && error.kind === "cancelled"
    ? "cancelled"
    : "failed";
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/** Options for a `get` call with one allowed credential and a fresh challenge. */
function getOptions(
  rpId: string,
  credentialId: Uint8Array,
  prfSalt: Uint8Array,
): PortGetOptions {
  return {
    rpId,
    challenge: randomBytes(CHALLENGE_BYTES),
    allowCredentialIds: [credentialId],
    userVerification: "required",
    prfSalt,
    timeoutMs: PASSKEY_TIMEOUT_MS,
  };
}

// --- Create (Create_Press, PRF_Check step 1) ----------------------------------

/**
 * Create the passkey. Returns the credential ID, the PRF salt and whatever PRF
 * result `create` carried, for `confirmPasskey` to check.
 */
export async function createPasskey(
  port: AuthenticatorPort,
  input: { rpId: string; userName?: string },
): Promise<CreatePasskeyResult> {
  if (!port.isAvailable()) {
    return { ok: false, reason: "unsupported" };
  }
  const prfSalt = randomBytes(PRF_SALT_BYTES);
  const options: PortCreateOptions = {
    rpId: input.rpId,
    rpName: PASSKEY_RP_NAME,
    userId: randomBytes(USER_ID_BYTES),
    userName: input.userName ?? PASSKEY_USER_NAME,
    userDisplayName: PASSKEY_USER_DISPLAY_NAME,
    challenge: randomBytes(CHALLENGE_BYTES),
    pubKeyCredParams: pubKeyCredParams(),
    residentKey: "required",
    userVerification: "required",
    attestation: "none",
    prfSalt,
    timeoutMs: PASSKEY_TIMEOUT_MS,
  };

  let result: PortResult;
  try {
    result = await port.create(options);
  } catch (error) {
    return { ok: false, reason: portErrorReason(error) };
  }

  const idLength = result.credentialId.length;
  if (idLength < 1 || idLength > CREDENTIAL_ID_MAX_BYTES) {
    return { ok: false, reason: "failed" };
  }
  return {
    ok: true,
    credentialId: result.credentialId,
    prfSalt,
    createdPrf: result.prfResult,
  };
}

// --- Confirm (Confirm_Press, PRF_Check steps 2 to 4) --------------------------

/**
 * Run `get` on the new credential and check the PRF result. The checks run in
 * this order and stop at the first failure: a 32-byte PRF result (`no_prf`),
 * the same credential (`failed`), and the created PRF equal when present
 * (`prf_mismatch`).
 */
export async function confirmPasskey(
  port: AuthenticatorPort,
  input: {
    rpId: string;
    credentialId: Uint8Array;
    prfSalt: Uint8Array;
    createdPrf: Uint8Array | null;
  },
): Promise<ConfirmPasskeyResult> {
  let result: PortResult;
  try {
    result = await port.get(
      getOptions(input.rpId, input.credentialId, input.prfSalt),
    );
  } catch (error) {
    return { ok: false, reason: portErrorReason(error) };
  }

  const prf = result.prfResult;
  if (prf === null || prf.length !== PRF_OUTPUT_BYTES) {
    return { ok: false, reason: "no_prf" };
  }
  if (!sameBytes(result.credentialId, input.credentialId)) {
    return { ok: false, reason: "failed" };
  }
  if (input.createdPrf !== null && !sameBytes(input.createdPrf, prf)) {
    return { ok: false, reason: "prf_mismatch" };
  }
  return {
    ok: true,
    credentialId: input.credentialId,
    prfSalt: input.prfSalt,
    prfOutput: prf.slice(),
  };
}

// --- Assert (opening a letter with its passkey) -------------------------------

/**
 * Get the PRF output for an existing credential. A page on a different host
 * than the letter's `rpId` gets `wrong_domain` and the port is never called.
 */
export async function assertPasskey(
  port: AuthenticatorPort,
  input: {
    rpId: string;
    credentialId: Uint8Array;
    prfSalt: Uint8Array;
    pageHostname?: string;
  },
): Promise<AssertPasskeyResult> {
  const hostname =
    input.pageHostname ??
    (globalThis as { location?: { hostname?: string } }).location?.hostname;
  if (hostname !== input.rpId) {
    return { ok: false, reason: "wrong_domain" };
  }
  if (!port.isAvailable()) {
    return { ok: false, reason: "unsupported" };
  }

  let result: PortResult;
  try {
    result = await port.get(
      getOptions(input.rpId, input.credentialId, input.prfSalt),
    );
  } catch (error) {
    return { ok: false, reason: portErrorReason(error) };
  }

  const prf = result.prfResult;
  if (prf === null || prf.length !== PRF_OUTPUT_BYTES) {
    return { ok: false, reason: "no_prf" };
  }
  return { ok: true, prfOutput: prf.slice() };
}
