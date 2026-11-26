// The Simulated_Port: a software stand-in for a platform passkey (spec 20, Part B,
// design.md section 4.1). For live demo letters only (/demo/live). Never used
// for a real letter, and never reachable from /seal or /l/[id].
//
// It imports nothing but the port types. It reads no navigator, storage,
// console, network or history API, so no credential or secret byte can leave
// this closure.

import {
  PortError,
  type AuthenticatorPort,
  type PortCreateOptions,
  type PortGetOptions,
  type PortResult,
} from "./authenticator-port";

const SECRET_BYTES = 32;
const CREDENTIAL_ID_BYTES = 32;

/**
 * Copies bytes into a Uint8Array backed by a plain ArrayBuffer, which WebCrypto
 * requires in the type system. The copy never aliases the caller's bytes.
 */
function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  return out;
}

/** True when both byte arrays have the same length and the same bytes. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * A software stand-in for a platform passkey, for live demo letters only.
 * The HMAC key is random, non-extractable and lives in this closure. It is never
 * stored, logged or sent. A page reload loses it, and with it the passkey wrap.
 */
export async function createSimulatedPort(): Promise<AuthenticatorPort> {
  const raw = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    throw new PortError("failed");
  } finally {
    // WebCrypto copies the key bytes during importKey, so the key survives this.
    raw.fill(0);
  }

  const issued: Uint8Array[] = [];

  async function prf(salt: Uint8Array): Promise<Uint8Array> {
    try {
      const mac = await crypto.subtle.sign(
        "HMAC",
        key,
        toArrayBufferView(salt),
      );
      return new Uint8Array(mac);
    } catch {
      throw new PortError("failed");
    }
  }

  return Object.freeze({
    isAvailable: (): boolean => true,

    async create(options: PortCreateOptions): Promise<PortResult> {
      const credentialId = crypto.getRandomValues(
        new Uint8Array(CREDENTIAL_ID_BYTES),
      );
      const prfResult = await prf(options.prfSalt);
      issued.push(credentialId.slice());
      return { credentialId: credentialId.slice(), prfResult };
    },

    async get(options: PortGetOptions): Promise<PortResult> {
      const match = options.allowCredentialIds.find((id) =>
        issued.some((own) => bytesEqual(own, id)),
      );
      if (match === undefined) throw new PortError("failed");
      return { credentialId: match.slice(), prfResult: await prf(options.prfSalt) };
    },
  });
}
