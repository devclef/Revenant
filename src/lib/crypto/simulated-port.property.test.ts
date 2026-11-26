import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import {
  PortError,
  type PortCreateOptions,
  type PortGetOptions,
} from "./authenticator-port";
import { confirmPasskey } from "./passkey";
import { createSimulatedPort } from "./simulated-port";

// Feature: 20-easier-sealing-and-receipts, Part B: the Simulated_Port
// (design.md Properties 11, 12 and 13; Requirements 10.3, 10.4, 10.5, 10.6,
// 10.10). Each property runs 100 times. WebCrypto only; no WebAuthn call.

const RP_ID = "revenant.devclef.se";
const RUNS = 100;
const SALT_LENGTH = 32;
const ID_LENGTH = 32;

/** Copies bytes into a Uint8Array backed by a plain ArrayBuffer, as WebCrypto types require. */
function toBuf(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  return out;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((byte, i) => byte === b[i]);
}

/** HMAC-SHA256 computed by the test on its own, from the secret and the salt. */
async function hmacSha256(
  secret: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    toBuf(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, toBuf(data)));
}

/**
 * Replaces crypto.getRandomValues with a seeded stub. Each call returns the
 * next queued array, in order. When the queue is empty the real function runs.
 */
function stubRandomValues(queue: Uint8Array[]): void {
  vi.restoreAllMocks();
  const original = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(((
    array: Uint8Array,
  ) => {
    const next = queue.shift();
    if (next === undefined) return original(array);
    array.set(next);
    return array;
  }) as typeof globalThis.crypto.getRandomValues);
}

function createOptions(prfSalt: Uint8Array): PortCreateOptions {
  return {
    rpId: RP_ID,
    rpName: "Revenant",
    userId: new Uint8Array(16),
    userName: "Revenant demo",
    userDisplayName: "Revenant demo",
    challenge: new Uint8Array(32),
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    residentKey: "required",
    userVerification: "required",
    attestation: "none",
    prfSalt,
    timeoutMs: 60_000,
  };
}

function getOptions(
  prfSalt: Uint8Array,
  allowCredentialIds: readonly Uint8Array[],
): PortGetOptions {
  return {
    rpId: RP_ID,
    challenge: new Uint8Array(32),
    allowCredentialIds,
    userVerification: "required",
    prfSalt,
    timeoutMs: 60_000,
  };
}

/** Resolves with the PortError kind a rejected promise carries, or a marker. */
async function rejectionKind(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof PortError ? error.kind : "other";
  }
  return "resolved";
}

const saltArb = fc.uint8Array({ minLength: SALT_LENGTH, maxLength: SALT_LENGTH });
const secretArb = fc.uint8Array({ minLength: 32, maxLength: 32 });
const idArb = fc.uint8Array({ minLength: ID_LENGTH, maxLength: ID_LENGTH });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Simulated_Port property tests", () => {
  // Property 11: create and get agree with HMAC-SHA256 (Requirements 10.3, 10.4, 10.6).
  it("Property 11: create and get agree, and match HMAC-SHA256 of the salt", async () => {
    await fc.assert(
      fc.asyncProperty(saltArb, secretArb, async (salt, secret) => {
        stubRandomValues([toBuf(secret)]);
        const port = await createSimulatedPort();
        const expected = await hmacSha256(secret, salt);

        const created = await port.create(createOptions(salt));
        expect(created.credentialId.length).toBe(ID_LENGTH);
        expect(created.prfResult).toEqual(expected);

        const credentialId = created.credentialId.slice();
        const prfCopy = created.prfResult?.slice() ?? null;
        const got = await port.get(getOptions(salt, [credentialId]));
        expect(got.credentialId).toEqual(credentialId);
        expect(got.prfResult).toEqual(expected);

        const check = await confirmPasskey(port, {
          rpId: RP_ID,
          credentialId,
          prfSalt: salt,
          createdPrf: prfCopy,
        });
        expect(check.ok).toBe(true);

        // Changing the arrays a caller holds must not change the port's state.
        created.credentialId.fill(0);
        created.prfResult?.fill(0);
        got.credentialId.fill(0);
        got.prfResult?.fill(0);
        const again = await port.get(getOptions(salt, [credentialId]));
        expect(again.prfResult).toEqual(expected);
      }),
      { numRuns: RUNS },
    );
  });

  // Property 12: two Simulated_Ports never share a PRF (Requirements 10.6, 10.10).
  it("Property 12: two ports with different secrets never give the same PRF", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .tuple(secretArb, secretArb, saltArb)
          .filter(([a, b]) => !equalBytes(a, b)),
        async ([secretA, secretB, salt]) => {
          stubRandomValues([toBuf(secretA), toBuf(secretB)]);
          const portA = await createSimulatedPort();
          const portB = await createSimulatedPort();

          const prfA = (await portA.create(createOptions(salt))).prfResult;
          const prfB = (await portB.create(createOptions(salt))).prfResult;

          // The stub fed each port its own secret, so each PRF is that secret's HMAC.
          expect(prfA).toEqual(await hmacSha256(secretA, salt));
          expect(prfB).toEqual(await hmacSha256(secretB, salt));
          expect(prfA).not.toEqual(prfB);
        },
      ),
      { numRuns: RUNS },
    );
  });

  // Property 13: credentials the port did not issue are refused (Requirement 10.5).
  it("Property 13: a port refuses unissued credentials and an empty list", async () => {
    await fc.assert(
      fc.asyncProperty(idArb, saltArb, async (foreign, salt) => {
        stubRandomValues([]);
        const port = await createSimulatedPort();
        const other = await createSimulatedPort();
        const own = await port.create(createOptions(salt));
        const otherIssued = await other.create(createOptions(salt));
        fc.pre(!equalBytes(foreign, own.credentialId));
        fc.pre(!equalBytes(foreign, otherIssued.credentialId));

        // Sanity: the port's own credential still works.
        const ok = await port.get(getOptions(salt, [own.credentialId]));
        expect(ok.prfResult).toEqual(own.prfResult);

        expect(
          await rejectionKind(
            port.get(getOptions(salt, [toBuf(foreign)])),
          ),
        ).toBe("failed");
        expect(
          await rejectionKind(
            port.get(getOptions(salt, [otherIssued.credentialId])),
          ),
        ).toBe("failed");
        expect(
          await rejectionKind(port.get(getOptions(salt, []))),
        ).toBe("failed");
      }),
      { numRuns: RUNS },
    );
  });
});
