// Tests for the browser Authenticator_Port (authenticator-port.ts). The browser
// API is replaced with stubs on globalThis, so these run in Node with no DOM.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PortError,
  browserAuthenticatorPort,
  type PortCreateOptions,
  type PortGetOptions,
} from "./authenticator-port";

const RP_ID = "revenant.devclef.se";

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function buffer(...values: number[]): ArrayBuffer {
  return Uint8Array.from(values).buffer;
}

function createOptions(): PortCreateOptions {
  return {
    rpId: RP_ID,
    rpName: "Revenant",
    userId: bytes(1, 2, 3),
    userName: "Revenant demo",
    userDisplayName: "Revenant demo",
    challenge: bytes(9, 9),
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    residentKey: "required",
    userVerification: "required",
    attestation: "none",
    prfSalt: bytes(4, 5, 6),
    timeoutMs: 120_000,
  };
}

function getOptions(): PortGetOptions {
  return {
    rpId: RP_ID,
    challenge: bytes(7, 7),
    allowCredentialIds: [bytes(8, 8, 8)],
    userVerification: "required",
    prfSalt: bytes(4, 5, 6),
    timeoutMs: 120_000,
  };
}

/** A credential shaped like the browser's PublicKeyCredential, by duck typing. */
function credential(prfFirst?: ArrayBuffer): unknown {
  return {
    rawId: buffer(1, 2, 3, 4),
    getClientExtensionResults: () =>
      prfFirst === undefined ? {} : { prf: { results: { first: prfFirst } } },
  };
}

function domException(name: string): DOMException {
  return new DOMException("browser says something private", name);
}

function stubCredentials(create: unknown, get: unknown = vi.fn()): void {
  vi.stubGlobal("navigator", { credentials: { create, get } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browserAuthenticatorPort.isAvailable", () => {
  it("is false when PublicKeyCredential is missing", () => {
    stubCredentials(vi.fn());
    vi.stubGlobal("PublicKeyCredential", undefined);
    expect(browserAuthenticatorPort.isAvailable()).toBe(false);
  });

  it("is false when navigator.credentials.create is missing", () => {
    vi.stubGlobal("PublicKeyCredential", class {});
    vi.stubGlobal("navigator", { credentials: {} });
    expect(browserAuthenticatorPort.isAvailable()).toBe(false);
  });

  it("is true when both the class and create are present", () => {
    vi.stubGlobal("PublicKeyCredential", class {});
    stubCredentials(vi.fn());
    expect(browserAuthenticatorPort.isAvailable()).toBe(true);
  });
});

describe("browserAuthenticatorPort call-time lookup", () => {
  it("calls a create replacement installed after import", async () => {
    const replacement = vi.fn(async () => credential(buffer(1)));
    stubCredentials(replacement);

    await browserAuthenticatorPort.create(createOptions());

    expect(replacement).toHaveBeenCalledTimes(1);
  });

  it("calls a get replacement installed after import", async () => {
    const replacement = vi.fn(async () => credential(buffer(1)));
    stubCredentials(vi.fn(), replacement);

    await browserAuthenticatorPort.get(getOptions());

    expect(replacement).toHaveBeenCalledTimes(1);
  });
});

describe("browserAuthenticatorPort create options", () => {
  it("sends the PRF salt in extensions, with no authenticatorAttachment", async () => {
    const create = vi.fn<(arg: unknown) => Promise<unknown>>(async () => credential(buffer(1)));
    stubCredentials(create);

    await browserAuthenticatorPort.create(createOptions());

    const arg = create.mock.calls[0]?.[0] as {
      publicKey: Record<string, unknown>;
    };
    const publicKey = arg.publicKey;
    expect(publicKey).toMatchObject({
      rp: { id: RP_ID, name: "Revenant" },
      user: { name: "Revenant demo", displayName: "Revenant demo" },
      attestation: "none",
      timeout: 120_000,
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
    });
    expect(publicKey).not.toHaveProperty("authenticatorAttachment");
    expect(publicKey).not.toHaveProperty("authenticatorSelection.authenticatorAttachment");
    const prf = (publicKey.extensions as { prf: { eval: { first: ArrayBuffer } } }).prf;
    expect(new Uint8Array(prf.eval.first)).toEqual(bytes(4, 5, 6));
  });

  it("copies binary fields as ArrayBuffers", async () => {
    const create = vi.fn<(arg: unknown) => Promise<unknown>>(async () => credential(buffer(1)));
    stubCredentials(create);

    await browserAuthenticatorPort.create(createOptions());

    const publicKey = (create.mock.calls[0]?.[0] as { publicKey: { user: { id: unknown } } })
      .publicKey;
    expect(publicKey.user.id).toBeInstanceOf(ArrayBuffer);
  });

  it("sends allowCredentials and the PRF salt on get", async () => {
    const get = vi.fn<(arg: unknown) => Promise<unknown>>(async () => credential(buffer(1)));
    stubCredentials(vi.fn(), get);

    await browserAuthenticatorPort.get(getOptions());

    const publicKey = (get.mock.calls[0]?.[0] as { publicKey: Record<string, unknown> })
      .publicKey;
    expect(publicKey.rpId).toBe(RP_ID);
    const allow = publicKey.allowCredentials as Array<{ type: string; id: ArrayBuffer }>;
    expect(allow).toHaveLength(1);
    expect(allow[0]?.type).toBe("public-key");
    expect(new Uint8Array(allow[0]!.id)).toEqual(bytes(8, 8, 8));
  });
});

describe("browserAuthenticatorPort result parsing", () => {
  it("returns the credential ID and the PRF result read by duck typing", async () => {
    stubCredentials(vi.fn(async () => credential(buffer(10, 11, 12))));

    const result = await browserAuthenticatorPort.create(createOptions());

    expect(result.credentialId).toEqual(bytes(1, 2, 3, 4));
    expect(result.prfResult).toEqual(bytes(10, 11, 12));
  });

  it("returns a null PRF result when the extension result is absent", async () => {
    stubCredentials(vi.fn(async () => credential()));

    const result = await browserAuthenticatorPort.create(createOptions());

    expect(result.prfResult).toBeNull();
  });

  it("accepts a credential that is not an instance of PublicKeyCredential", async () => {
    vi.stubGlobal("PublicKeyCredential", class Real {});
    stubCredentials(vi.fn(), vi.fn(async () => credential(buffer(5))));

    const result = await browserAuthenticatorPort.get(getOptions());

    expect(result.prfResult).toEqual(bytes(5));
  });
});

describe("browserAuthenticatorPort error mapping", () => {
  it.each(["NotAllowedError", "AbortError"])(
    "maps %s to a cancelled PortError",
    async (name) => {
      stubCredentials(vi.fn(async () => Promise.reject(domException(name))));

      const err = await browserAuthenticatorPort.create(createOptions()).catch((e) => e);

      expect(err).toBeInstanceOf(PortError);
      expect((err as PortError).kind).toBe("cancelled");
    },
  );

  it("maps another DOMException to a failed PortError", async () => {
    stubCredentials(vi.fn(async () => Promise.reject(domException("InvalidStateError"))));

    const err = await browserAuthenticatorPort.create(createOptions()).catch((e) => e);

    expect((err as PortError).kind).toBe("failed");
  });

  it("maps a plain thrown Error to a failed PortError", async () => {
    stubCredentials(vi.fn(async () => Promise.reject(new Error("network"))));

    const err = await browserAuthenticatorPort.get(getOptions()).catch((e) => e);

    expect((err as PortError).kind).toBe("failed");
  });

  it("maps a null credential to a failed PortError", async () => {
    stubCredentials(vi.fn(async () => null));

    const err = await browserAuthenticatorPort.create(createOptions()).catch((e) => e);

    expect((err as PortError).kind).toBe("failed");
  });

  it("maps a credential with no rawId to a failed PortError", async () => {
    stubCredentials(
      vi.fn(async () => ({ getClientExtensionResults: () => ({}) })),
    );

    const err = await browserAuthenticatorPort.create(createOptions()).catch((e) => e);

    expect((err as PortError).kind).toBe("failed");
  });

  it("maps a missing credentials container to a failed PortError", async () => {
    vi.stubGlobal("navigator", {});

    const err = await browserAuthenticatorPort.get(getOptions()).catch((e) => e);

    expect((err as PortError).kind).toBe("failed");
  });

  it("uses a fixed message and never copies the browser's text", async () => {
    stubCredentials(vi.fn(async () => Promise.reject(domException("InvalidStateError"))));

    const err = (await browserAuthenticatorPort.create(createOptions()).catch((e) => e)) as Error;

    expect(err.message).not.toContain("private");
    expect(err.message).toBe("The passkey request failed.");
  });

  it("uses a fixed message for the cancelled kind", () => {
    expect(new PortError("cancelled").message).toBe("The passkey request was cancelled.");
    expect(new PortError("cancelled").name).toBe("PortError");
  });
});
