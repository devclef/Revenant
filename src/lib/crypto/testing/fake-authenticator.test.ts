// Tests for the fake Authenticator_Port. The fake's PRF is HMAC-SHA-256 over
// the salt, so the same credential and salt must give the same bytes on create
// and get, and each failure mode must raise the matching PortError kind.

import { describe, expect, it } from "vitest";
import { PortError, type PortCreateOptions, type PortGetOptions } from "../authenticator-port";
import { createFakeAuthenticator } from "./fake-authenticator";

const SALT = Uint8Array.from({ length: 32 }, (_, i) => i);

function createOptions(): PortCreateOptions {
  return {
    rpId: "localhost",
    rpName: "Revenant",
    userId: new Uint8Array(16),
    userName: "Revenant demo",
    userDisplayName: "Revenant demo",
    challenge: new Uint8Array(32),
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    residentKey: "required",
    userVerification: "required",
    attestation: "none",
    prfSalt: SALT,
    timeoutMs: 120_000,
  };
}

function getOptions(): PortGetOptions {
  return {
    rpId: "localhost",
    challenge: new Uint8Array(32),
    allowCredentialIds: [],
    userVerification: "required",
    prfSalt: SALT,
    timeoutMs: 120_000,
  };
}

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "resolved";
  } catch (error) {
    return error instanceof PortError ? error.kind : "other";
  }
}

describe("createFakeAuthenticator", () => {
  it("gives the same PRF on create and get for the same salt", async () => {
    const fake = createFakeAuthenticator();
    const created = await fake.create(createOptions());
    const got = await fake.get(getOptions());

    expect(created.prfResult).toHaveLength(32);
    expect(got.prfResult).toEqual(created.prfResult);
    expect(got.credentialId).toEqual(created.credentialId);
  });

  it("records every call with its method and options", async () => {
    const fake = createFakeAuthenticator();
    await fake.create(createOptions());
    await fake.get(getOptions());

    expect(fake.calls.map((c) => c.method)).toEqual(["create", "get"]);
    expect(fake.calls[0]?.options).toMatchObject({ rpId: "localhost" });
  });

  it("returns null PRF for createPrf and getPrf 'none'", async () => {
    const fake = createFakeAuthenticator({ createPrf: "none", getPrf: "none" });

    expect((await fake.create(createOptions())).prfResult).toBeNull();
    expect((await fake.get(getOptions())).prfResult).toBeNull();
  });

  it("returns 31 bytes for getPrf 'short'", async () => {
    const fake = createFakeAuthenticator({ getPrf: "short" });
    await fake.create(createOptions());

    expect((await fake.get(getOptions())).prfResult).toHaveLength(31);
  });

  it("flips the first byte for getPrf 'mismatch'", async () => {
    const fake = createFakeAuthenticator();
    const created = await fake.create(createOptions());
    fake.configure({ getPrf: "mismatch" });
    const got = await fake.get(getOptions());

    expect(got.prfResult?.[0]).toBe((created.prfResult?.[0] ?? 0) ^ 0xff);
    expect(got.prfResult?.slice(1)).toEqual(created.prfResult?.slice(1));
  });

  it("reports availability from the config and supports configure", () => {
    const fake = createFakeAuthenticator({ available: false });
    expect(fake.isAvailable()).toBe(false);
    fake.configure({ available: true });
    expect(fake.isAvailable()).toBe(true);
  });

  it.each([
    ["cancel_create", "create", "cancelled"],
    ["error_create", "create", "failed"],
  ] as const)("raises a PortError for %s", async (failure, method, kind) => {
    const fake = createFakeAuthenticator({ failure });
    const run = method === "create" ? fake.create(createOptions()) : fake.get(getOptions());
    expect(await kindOf(run)).toBe(kind);
  });

  it.each([
    ["cancel_get", "cancelled"],
    ["error_get", "failed"],
  ] as const)("raises a PortError for %s", async (failure, kind) => {
    const fake = createFakeAuthenticator({ failure });
    expect(await kindOf(fake.get(getOptions()))).toBe(kind);
  });

  it("only fails the matching method", async () => {
    const fake = createFakeAuthenticator({ failure: "cancel_get" });
    expect(await kindOf(fake.create(createOptions()))).toBe("resolved");
  });
});
