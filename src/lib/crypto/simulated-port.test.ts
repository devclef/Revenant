import { afterEach, describe, expect, it, vi } from "vitest";
import { PortError, type PortCreateOptions, type PortGetOptions } from "./authenticator-port";
import { confirmPasskey } from "./passkey";
import { createSimulatedPort } from "./simulated-port";

// Unit tests for the Simulated_Port (spec 20, Part B, design.md section 4.1).
// WebCrypto only; no WebAuthn call. The property tests live in
// simulated-port.property.test.ts.

const RP_ID = "revenant.devclef.se";

function createOptions(prfSalt: Uint8Array): PortCreateOptions {
  return {
    rpId: RP_ID,
    rpName: "Revenant demo",
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

/** Rejection kind of a promise, or "resolved" when it does not reject. */
async function rejectionKind(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof PortError ? error.kind : "other";
  }
  return "resolved";
}

/** Hex, decimal and base64 renderings of bytes, so a leak in any form is caught. */
function renderings(bytes: Uint8Array): string[] {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const decimal = Array.from(bytes).join(",");
  const base64 = Buffer.from(bytes).toString("base64");
  return [hex, decimal, base64];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createSimulatedPort", () => {
  it("isAvailable returns true without reading navigator", async () => {
    const navigatorSpy = vi.spyOn(globalThis, "navigator", "get");
    const port = await createSimulatedPort();
    expect(port.isAvailable()).toBe(true);
    expect(navigatorSpy).not.toHaveBeenCalled();
  });

  it("imports the key non-extractable with usages ['sign'], then zeroes the raw bytes", async () => {
    const original = crypto.subtle.importKey.bind(crypto.subtle);
    let rawSeen: Uint8Array | null = null;
    const spy = vi
      .spyOn(crypto.subtle, "importKey")
      .mockImplementation((format, keyData, algorithm, extractable, usages) => {
        rawSeen = keyData as Uint8Array;
        return original(format, keyData, algorithm, extractable, usages);
      });

    await createSimulatedPort();

    expect(spy).toHaveBeenCalledTimes(1);
    const args = spy.mock.calls[0];
    expect(args[0]).toBe("raw");
    expect(args[2]).toEqual({ name: "HMAC", hash: "SHA-256" });
    expect(args[3]).toBe(false);
    expect(args[4]).toEqual(["sign"]);
    expect(rawSeen).not.toBeNull();
    expect(rawSeen!.length).toBe(32);
    expect(Array.from(rawSeen!).every((b) => b === 0)).toBe(true);
  });

  it("gives PortError('failed') with the fixed message when importKey rejects", async () => {
    vi.spyOn(crypto.subtle, "importKey").mockRejectedValue(new Error("boom"));
    const error = await createSimulatedPort().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PortError);
    expect((error as PortError).kind).toBe("failed");
    expect((error as PortError).message).toBe("The passkey request failed.");
  });

  it("gives PortError('failed') with the fixed message when sign rejects", async () => {
    const port = await createSimulatedPort();
    vi.spyOn(crypto.subtle, "sign").mockRejectedValue(new Error("boom"));
    const error = await port
      .create(createOptions(new Uint8Array(32)))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PortError);
    expect((error as PortError).kind).toBe("failed");
    expect((error as PortError).message).toBe("The passkey request failed.");
  });

  it("gives PortError('failed') from get when sign rejects", async () => {
    const port = await createSimulatedPort();
    const created = await port.create(createOptions(new Uint8Array(32)));
    vi.spyOn(crypto.subtle, "sign").mockRejectedValue(new Error("boom"));
    expect(
      await rejectionKind(
        port.get(getOptions(new Uint8Array(32), [created.credentialId])),
      ),
    ).toBe("failed");
  });

  it("exposes exactly isAvailable, create and get as enumerable keys", async () => {
    const port = await createSimulatedPort();
    const own = Object.keys(port).sort();
    const all: string[] = [];
    for (const key in port) all.push(key);
    expect(own).toEqual(["create", "get", "isAvailable"]);
    expect(all.sort()).toEqual(["create", "get", "isAvailable"]);
  });

  it("does not leak the secret through JSON, String or thrown errors", async () => {
    // Capture the secret bytes while importKey still sees them, before they are zeroed.
    const original = crypto.subtle.importKey.bind(crypto.subtle);
    let secret: Uint8Array | null = null;
    vi.spyOn(crypto.subtle, "importKey").mockImplementation(
      (format, keyData, algorithm, extractable, usages) => {
        secret = (keyData as Uint8Array).slice();
        return original(format, keyData, algorithm, extractable, usages);
      },
    );

    const port = await createSimulatedPort();
    const salt = new Uint8Array(32).fill(7);
    const created = await port.create(createOptions(salt));
    const prf = created.prfResult ?? new Uint8Array();
    expect(secret).not.toBeNull();

    const secretForms = renderings(secret!);
    const prfForms = renderings(prf);
    const serialized = [
      JSON.stringify(port),
      String(port),
      JSON.stringify(created),
    ];

    const failure = await port
      .get(getOptions(salt, [new Uint8Array(32)]))
      .catch((e: unknown) => e);
    serialized.push(JSON.stringify(failure), String(failure));

    for (const text of serialized) {
      for (const form of [...secretForms, ...prfForms]) {
        expect(text.includes(form)).toBe(false);
      }
    }
  });

  it("confirmPasskey with the port returns ok true", async () => {
    const port = await createSimulatedPort();
    const salt = new Uint8Array(32).fill(3);
    const created = await port.create(createOptions(salt));
    const result = await confirmPasskey(port, {
      rpId: RP_ID,
      credentialId: created.credentialId,
      prfSalt: salt,
      createdPrf: created.prfResult,
    });
    expect(result.ok).toBe(true);
  });
});
