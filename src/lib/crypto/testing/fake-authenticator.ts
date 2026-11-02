// A fake Authenticator_Port for tests (design.md "Authenticator_Port and
// Passkey_Module"). It stands in for WebAuthn so the passkey and seal/open code
// can be tested in Node without a real passkey.
//
// The PRF is HMAC-SHA-256(prfKey, prfSalt), computed with WebCrypto. The same
// credential and salt give the same 32 bytes on `create` and `get`. The prfKey
// is a fixed TEST value. It is not a secret and must never be used outside
// tests.
//
// This module lives under `testing/` and is never re-exported from
// `src/lib/crypto/index.ts`. `no-fake-import.test.ts` enforces that.

import { PortError } from "../authenticator-port";
import type {
  AuthenticatorPort,
  PortCreateOptions,
  PortGetOptions,
  PortResult,
} from "../authenticator-port";

export interface FakeAuthenticatorConfig {
  /** HMAC key for the PRF. Defaults to 32 fixed test bytes. */
  prfKey?: Uint8Array;
  /** What `isAvailable()` returns. Defaults to true. */
  available?: boolean;
  /** Whether `create` returns a PRF value. Defaults to "results". */
  createPrf?: "results" | "none";
  /**
   * What `get` returns for the PRF. "results" is the 32-byte value, "none" is
   * null, "short" is 31 bytes, "mismatch" flips the first byte. Defaults to
   * "results".
   */
  getPrf?: "results" | "none" | "short" | "mismatch";
  /** Makes the next matching call raise a PortError. Defaults to null. */
  failure?: null | "cancel_create" | "cancel_get" | "error_create" | "error_get";
}

export interface FakeCall {
  method: "create" | "get";
  options: PortCreateOptions | PortGetOptions;
}

export interface FakeAuthenticator extends AuthenticatorPort {
  readonly calls: ReadonlyArray<FakeCall>;
  configure(patch: Partial<FakeAuthenticatorConfig>): void;
}

const DEFAULT_PRF_KEY = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 1) & 0xff);
const CREDENTIAL_ID_BYTES = 32;

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** HMAC-SHA-256(key, salt) through WebCrypto. */
async function hmacSha256(key: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto.subtle;
  const cryptoKey = await subtle.importKey(
    "raw",
    key.slice(),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await subtle.sign("HMAC", cryptoKey, salt.slice());
  return new Uint8Array(mac);
}

export function createFakeAuthenticator(
  initial: FakeAuthenticatorConfig = {},
): FakeAuthenticator {
  let config: Required<Omit<FakeAuthenticatorConfig, "failure">> & {
    failure: FakeAuthenticatorConfig["failure"];
  } = {
    prfKey: initial.prfKey ?? DEFAULT_PRF_KEY,
    available: initial.available ?? true,
    createPrf: initial.createPrf ?? "results",
    getPrf: initial.getPrf ?? "results",
    failure: initial.failure ?? null,
  };
  const calls: FakeCall[] = [];
  // Set by `create`; `get` returns it so a registered credential is found again.
  let credentialId: Uint8Array | null = null;

  async function prfFor(salt: Uint8Array): Promise<Uint8Array> {
    return hmacSha256(config.prfKey, salt);
  }

  return {
    get calls() {
      return calls;
    },

    configure(patch: Partial<FakeAuthenticatorConfig>): void {
      config = {
        prfKey: patch.prfKey ?? config.prfKey,
        available: patch.available ?? config.available,
        createPrf: patch.createPrf ?? config.createPrf,
        getPrf: patch.getPrf ?? config.getPrf,
        failure: "failure" in patch ? patch.failure ?? null : config.failure,
      };
    },

    isAvailable(): boolean {
      return config.available;
    },

    async create(options: PortCreateOptions): Promise<PortResult> {
      calls.push({ method: "create", options });
      if (config.failure === "cancel_create") throw new PortError("cancelled");
      if (config.failure === "error_create") throw new PortError("failed");

      credentialId = randomBytes(CREDENTIAL_ID_BYTES);
      const prfResult =
        config.createPrf === "results" ? await prfFor(options.prfSalt) : null;
      return { credentialId: credentialId.slice(), prfResult };
    },

    async get(options: PortGetOptions): Promise<PortResult> {
      calls.push({ method: "get", options });
      if (config.failure === "cancel_get") throw new PortError("cancelled");
      if (config.failure === "error_get") throw new PortError("failed");

      // Nothing was created yet: return the first allowed ID, or a fresh one.
      const id =
        credentialId ?? options.allowCredentialIds[0]?.slice() ?? randomBytes(CREDENTIAL_ID_BYTES);
      let prf: Uint8Array | null = null;
      if (config.getPrf === "results") {
        prf = await prfFor(options.prfSalt);
      } else if (config.getPrf === "short") {
        prf = (await prfFor(options.prfSalt)).slice(0, 31);
      } else if (config.getPrf === "mismatch") {
        prf = await prfFor(options.prfSalt);
        prf[0] = (prf[0] ?? 0) ^ 0xff;
      }
      return { credentialId: id.slice(), prfResult: prf };
    },
  };
}
