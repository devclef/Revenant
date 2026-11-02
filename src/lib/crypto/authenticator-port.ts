// The authenticator port: the one seam between the passkey module and the
// WebAuthn browser API (design.md "Authenticator_Port and Passkey_Module").
//
// Options and results use Uint8Array only, so the passkey logic and its tests
// need no DOM. The browser implementation is duck-typed: it reads `rawId` and
// `getClientExtensionResults()` and never uses `instanceof PublicKeyCredential`.
//
// `navigator.credentials` is looked up at call time, never at module load. The
// crypto module is preloaded before the QA stub is installed, so a captured
// reference would bypass the stub.
//
// Browser-only at runtime (WebAuthn), but importable in Node: nothing runs at
// module load.

/** Options for `navigator.credentials.create`, as the passkey module builds them. */
export interface PortCreateOptions {
  rpId: string;
  rpName: string;
  userId: Uint8Array;
  userName: string;
  userDisplayName: string;
  challenge: Uint8Array;
  pubKeyCredParams: ReadonlyArray<{ type: "public-key"; alg: number }>;
  residentKey: "required";
  userVerification: "required";
  attestation: "none";
  prfSalt: Uint8Array;
  timeoutMs: number;
}

/** Options for `navigator.credentials.get`. */
export interface PortGetOptions {
  rpId: string;
  challenge: Uint8Array;
  allowCredentialIds: readonly Uint8Array[];
  userVerification: "required";
  prfSalt: Uint8Array;
  timeoutMs: number;
}

/**
 * What the port returns. `prfResult` is the PRF output for the salt, or `null`
 * when the authenticator gave no PRF value.
 */
export interface PortResult {
  credentialId: Uint8Array;
  prfResult: Uint8Array | null;
}

const CANCELLED_MESSAGE = "The passkey request was cancelled.";
const FAILED_MESSAGE = "The passkey request failed.";

/**
 * The only error the port raises. The message is fixed per kind, so no thrown
 * text from the browser, and no byte value, ever reaches a log or a screen.
 */
export class PortError extends Error {
  readonly kind: "cancelled" | "failed";

  constructor(kind: "cancelled" | "failed") {
    super(kind === "cancelled" ? CANCELLED_MESSAGE : FAILED_MESSAGE);
    this.name = "PortError";
    this.kind = kind;
  }
}

export interface AuthenticatorPort {
  /** Synchronous. True when the WebAuthn credentials API looks present. */
  isAvailable(): boolean;
  create(options: PortCreateOptions): Promise<PortResult>;
  get(options: PortGetOptions): Promise<PortResult>;
}

// --- Browser implementation --------------------------------------------------

interface CredentialsLike {
  create(options: { publicKey: unknown }): Promise<unknown>;
  get(options: { publicKey: unknown }): Promise<unknown>;
}

/** Reads `navigator.credentials` now, so a replacement installed later is used. */
function currentCredentials(): CredentialsLike | undefined {
  const nav = (globalThis as { navigator?: { credentials?: unknown } }).navigator;
  const credentials = nav?.credentials as CredentialsLike | undefined;
  return credentials ?? undefined;
}

/** A fresh, exact-length ArrayBuffer copy, as WebAuthn expects for binary fields. */
function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

/** Duck-typed check: an ArrayBuffer-like value from the browser, never `instanceof`. */
function bytesFromBuffer(value: unknown): Uint8Array | null {
  if (
    typeof value === "object" &&
    value !== null &&
    Object.prototype.toString.call(value) === "[object ArrayBuffer]"
  ) {
    return new Uint8Array(value as ArrayBuffer);
  }
  return null;
}

/** Reads `prf.results.first` from a credential, or null when absent. */
function prfFirst(credential: {
  getClientExtensionResults(): unknown;
}): Uint8Array | null {
  const results = credential.getClientExtensionResults() as
    | { prf?: { results?: { first?: unknown } } }
    | undefined;
  return bytesFromBuffer(results?.prf?.results?.first);
}

/** Maps a thrown browser error to the port's two kinds. The message is dropped. */
function mapThrown(error: unknown): PortError {
  if (error instanceof PortError) return error;
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "NotAllowedError" || name === "AbortError") {
    return new PortError("cancelled");
  }
  return new PortError("failed");
}

async function toPortResult(
  credential: unknown,
): Promise<PortResult> {
  if (credential === null || credential === undefined) {
    throw new PortError("failed");
  }
  const cred = credential as {
    rawId?: unknown;
    getClientExtensionResults?: unknown;
  };
  if (typeof cred.getClientExtensionResults !== "function") {
    throw new PortError("failed");
  }
  const credentialId = bytesFromBuffer(cred.rawId);
  if (credentialId === null) {
    throw new PortError("failed");
  }
  const prfResult = prfFirst(
    cred as { getClientExtensionResults(): unknown },
  );
  return { credentialId, prfResult };
}

function isAvailableInBrowser(): boolean {
  const g = globalThis as {
    PublicKeyCredential?: unknown;
    navigator?: { credentials?: { create?: unknown } };
  };
  return (
    typeof g.PublicKeyCredential !== "undefined" &&
    typeof g.navigator?.credentials?.create === "function"
  );
}

async function createInBrowser(options: PortCreateOptions): Promise<PortResult> {
  try {
    const credentials = currentCredentials();
    if (!credentials) throw new PortError("failed");
    const credential = await credentials.create({
      publicKey: {
        rp: { id: options.rpId, name: options.rpName },
        user: {
          id: toBuffer(options.userId),
          name: options.userName,
          displayName: options.userDisplayName,
        },
        challenge: toBuffer(options.challenge),
        pubKeyCredParams: options.pubKeyCredParams,
        authenticatorSelection: {
          residentKey: options.residentKey,
          userVerification: options.userVerification,
        },
        attestation: options.attestation,
        timeout: options.timeoutMs,
        // No authenticatorAttachment: the browser may offer "use a phone or tablet".
        extensions: { prf: { eval: { first: toBuffer(options.prfSalt) } } },
      },
    });
    return await toPortResult(credential);
  } catch (error) {
    throw mapThrown(error);
  }
}

async function getInBrowser(options: PortGetOptions): Promise<PortResult> {
  try {
    const credentials = currentCredentials();
    if (!credentials) throw new PortError("failed");
    const credential = await credentials.get({
      publicKey: {
        rpId: options.rpId,
        challenge: toBuffer(options.challenge),
        allowCredentials: options.allowCredentialIds.map((id) => ({
          type: "public-key",
          id: toBuffer(id),
        })),
        userVerification: options.userVerification,
        timeout: options.timeoutMs,
        extensions: { prf: { eval: { first: toBuffer(options.prfSalt) } } },
      },
    });
    return await toPortResult(credential);
  } catch (error) {
    throw mapThrown(error);
  }
}

/** The real port, backed by `navigator.credentials`. */
export const browserAuthenticatorPort: AuthenticatorPort = {
  isAvailable: isAvailableInBrowser,
  create: createInBrowser,
  get: getInBrowser,
};
