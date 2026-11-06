// Passkey_Module tests (requirements R7, design.md Properties 9 and 10).
//
// Every test uses the fake Authenticator_Port, so no WebAuthn or DOM is needed.
// The call-order tests call each function without `await` and check the port
// was already called once, which is the first-async-step rule.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { AuthenticatorPort } from "./authenticator-port";
import {
  CHALLENGE_BYTES,
  CREDENTIAL_ID_MAX_BYTES,
  PASSKEY_RP_NAME,
  PASSKEY_TIMEOUT_MS,
  PASSKEY_USER_DISPLAY_NAME,
  PASSKEY_USER_NAME,
  PRF_OUTPUT_BYTES,
  PRF_SALT_BYTES,
  USER_ID_BYTES,
  assertPasskey,
  confirmPasskey,
  createPasskey,
} from "./passkey";
import { createFakeAuthenticator } from "./testing/fake-authenticator";
import type { FakeAuthenticator } from "./testing/fake-authenticator";

const RP_ID = "revenant.devclef.se";

/** A port that returns a fixed credential ID from `get`, to test a mismatch. */
function portReturningOtherCredential(fake: FakeAuthenticator): AuthenticatorPort {
  return {
    isAvailable: () => fake.isAvailable(),
    create: (options) => fake.create(options),
    get: async (options) => {
      const result = await fake.get(options);
      return {
        credentialId: result.credentialId.map((b) => b ^ 0x01),
        prfResult: result.prfResult,
      };
    },
  };
}

describe("createPasskey", () => {
  it("calls port.create synchronously, before any await", async () => {
    const fake = createFakeAuthenticator();
    const pending = createPasskey(fake, { rpId: RP_ID });
    expect(fake.calls.length).toBe(1);
    expect(fake.calls[0].method).toBe("create");
    await pending;
  });

  it("uses PASSKEY_USER_NAME as the userName when none is given", async () => {
    const fake = createFakeAuthenticator();
    await createPasskey(fake, { rpId: RP_ID });
    const options = fake.calls[0].options as unknown as Record<string, unknown>;
    expect(options.userName).toBe(PASSKEY_USER_NAME);
  });

  it("uses the userName given to createPasskey", async () => {
    const fake = createFakeAuthenticator();
    await createPasskey(fake, { rpId: RP_ID, userName: "Revenant real letter" });
    const options = fake.calls[0].options as unknown as Record<string, unknown>;
    expect(options.userName).toBe("Revenant real letter");
    expect(options.userDisplayName).toBe("Revenant demo");
  });

  it("sends the R7.2 create options", async () => {
    const fake = createFakeAuthenticator();
    await createPasskey(fake, { rpId: RP_ID });
    const options = fake.calls[0].options as unknown as Record<string, unknown>;

    expect(options.rpId).toBe(RP_ID);
    expect(options.rpName).toBe("Revenant");
    expect(PASSKEY_RP_NAME).toBe("Revenant");
    expect(options.userName).toBe("Revenant demo");
    expect(options.userDisplayName).toBe("Revenant demo");
    expect(PASSKEY_USER_NAME).toBe("Revenant demo");
    expect(PASSKEY_USER_DISPLAY_NAME).toBe("Revenant demo");

    const userId = options.userId as Uint8Array;
    expect(userId).toBeInstanceOf(Uint8Array);
    expect(userId.length).toBe(USER_ID_BYTES);
    expect(USER_ID_BYTES).toBe(16);

    const challenge = options.challenge as Uint8Array;
    expect(challenge.length).toBe(CHALLENGE_BYTES);
    expect(CHALLENGE_BYTES).toBe(32);

    expect(options.pubKeyCredParams).toEqual([
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ]);
    expect(options.residentKey).toBe("required");
    expect(options.userVerification).toBe("required");
    expect(options.attestation).toBe("none");
    expect(options.timeoutMs).toBe(120_000);
    expect(PASSKEY_TIMEOUT_MS).toBe(120_000);

    const prfSalt = options.prfSalt as Uint8Array;
    expect(prfSalt.length).toBe(PRF_SALT_BYTES);
    expect(PRF_SALT_BYTES).toBe(32);
  });

  it("never sends an authenticatorAttachment", async () => {
    const fake = createFakeAuthenticator();
    await createPasskey(fake, { rpId: RP_ID });
    expect(Object.keys(fake.calls[0].options)).not.toContain(
      "authenticatorAttachment",
    );
  });

  it("returns the credential, the salt and the created PRF on success", async () => {
    const fake = createFakeAuthenticator({ createPrf: "results" });
    const result = await createPasskey(fake, { rpId: RP_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.credentialId.length).toBeGreaterThan(0);
    expect(result.credentialId.length).toBeLessThanOrEqual(
      CREDENTIAL_ID_MAX_BYTES,
    );
    expect(result.prfSalt).toEqual(
      fake.calls[0].options.prfSalt as Uint8Array,
    );
    expect(result.createdPrf?.length).toBe(PRF_OUTPUT_BYTES);
  });

  it("returns createdPrf null when create carried no PRF", async () => {
    const fake = createFakeAuthenticator({ createPrf: "none" });
    const result = await createPasskey(fake, { rpId: RP_ID });
    expect(result).toMatchObject({ ok: true, createdPrf: null });
  });

  it("reports unsupported when the port is not available", async () => {
    const fake = createFakeAuthenticator({ available: false });
    const result = await createPasskey(fake, { rpId: RP_ID });
    expect(result).toEqual({ ok: false, reason: "unsupported" });
    expect(fake.calls.length).toBe(0);
  });

  it("reports cancelled when the user dismisses the prompt", async () => {
    const fake = createFakeAuthenticator({ failure: "cancel_create" });
    expect(await createPasskey(fake, { rpId: RP_ID })).toEqual({
      ok: false,
      reason: "cancelled",
    });
  });

  it("reports failed for any other port error", async () => {
    const fake = createFakeAuthenticator({ failure: "error_create" });
    expect(await createPasskey(fake, { rpId: RP_ID })).toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("reports failed for an empty credential ID", async () => {
    const empty: AuthenticatorPort = {
      isAvailable: () => true,
      create: async () => ({
        credentialId: new Uint8Array(0),
        prfResult: null,
      }),
      get: async () => {
        throw new Error("not used");
      },
    };
    expect(await createPasskey(empty, { rpId: RP_ID })).toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("reports failed for an oversized credential ID", async () => {
    const big: AuthenticatorPort = {
      isAvailable: () => true,
      create: async () => ({
        credentialId: new Uint8Array(CREDENTIAL_ID_MAX_BYTES + 1),
        prfResult: null,
      }),
      get: async () => {
        throw new Error("not used");
      },
    };
    expect(await createPasskey(big, { rpId: RP_ID })).toEqual({
      ok: false,
      reason: "failed",
    });
  });
});

describe("confirmPasskey", () => {
  async function created(fake: FakeAuthenticator) {
    const result = await createPasskey(fake, { rpId: RP_ID });
    if (!result.ok) throw new Error("create failed in test setup");
    return result;
  }

  it("calls port.get synchronously, before any await", async () => {
    const fake = createFakeAuthenticator();
    const c = await created(fake);
    const before = fake.calls.length;
    const pending = confirmPasskey(fake, {
      rpId: RP_ID,
      credentialId: c.credentialId,
      prfSalt: c.prfSalt,
      createdPrf: c.createdPrf,
    });
    expect(fake.calls.length).toBe(before + 1);
    expect(fake.calls[before].method).toBe("get");
    await pending;
  });

  it("passes the same salt, the credential and a fresh challenge to get", async () => {
    const fake = createFakeAuthenticator();
    const c = await created(fake);
    await confirmPasskey(fake, {
      rpId: RP_ID,
      credentialId: c.credentialId,
      prfSalt: c.prfSalt,
      createdPrf: c.createdPrf,
    });
    const options = fake.calls[1].options as unknown as Record<string, unknown>;
    expect(options.rpId).toBe(RP_ID);
    expect(options.userVerification).toBe("required");
    expect(options.allowCredentialIds).toEqual([c.credentialId]);
    expect(options.prfSalt).toEqual(c.prfSalt);
    expect((options.challenge as Uint8Array).length).toBe(CHALLENGE_BYTES);
  });

  it("returns prfOutput equal to the created PRF on success", async () => {
    const fake = createFakeAuthenticator({ createPrf: "results" });
    const c = await created(fake);
    const result = await confirmPasskey(fake, {
      rpId: RP_ID,
      credentialId: c.credentialId,
      prfSalt: c.prfSalt,
      createdPrf: c.createdPrf,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prfOutput.length).toBe(PRF_OUTPUT_BYTES);
    expect(result.prfOutput).toEqual(c.createdPrf as Uint8Array);
  });

  it("succeeds with no created PRF when get gives a 32-byte PRF", async () => {
    const fake = createFakeAuthenticator({ createPrf: "none" });
    const c = await created(fake);
    const result = await confirmPasskey(fake, {
      rpId: RP_ID,
      credentialId: c.credentialId,
      prfSalt: c.prfSalt,
      createdPrf: null,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it("reports no_prf when get has no PRF result", async () => {
    const fake = createFakeAuthenticator({ getPrf: "none" });
    const c = await created(fake);
    const result = await confirmPasskey(fake, {
      rpId: RP_ID,
      credentialId: c.credentialId,
      prfSalt: c.prfSalt,
      createdPrf: c.createdPrf,
    });
    expect(result).toEqual({ ok: false, reason: "no_prf" });
    expect("prfOutput" in result).toBe(false);
  });

  it("reports no_prf for a 31-byte PRF result", async () => {
    const fake = createFakeAuthenticator({ getPrf: "short" });
    const c = await created(fake);
    const result = await confirmPasskey(fake, {
      rpId: RP_ID,
      credentialId: c.credentialId,
      prfSalt: c.prfSalt,
      createdPrf: c.createdPrf,
    });
    expect(result).toEqual({ ok: false, reason: "no_prf" });
  });

  it("reports prf_mismatch when get differs from the created PRF", async () => {
    const fake = createFakeAuthenticator({
      createPrf: "results",
      getPrf: "mismatch",
    });
    const c = await created(fake);
    const result = await confirmPasskey(fake, {
      rpId: RP_ID,
      credentialId: c.credentialId,
      prfSalt: c.prfSalt,
      createdPrf: c.createdPrf,
    });
    expect(result).toEqual({ ok: false, reason: "prf_mismatch" });
    expect("prfOutput" in result).toBe(false);
  });

  it("reports failed when get returns a different credential", async () => {
    const fake = createFakeAuthenticator();
    const c = await created(fake);
    const result = await confirmPasskey(portReturningOtherCredential(fake), {
      rpId: RP_ID,
      credentialId: c.credentialId,
      prfSalt: c.prfSalt,
      createdPrf: c.createdPrf,
    });
    expect(result).toEqual({ ok: false, reason: "failed" });
  });

  it("reports cancelled when the user dismisses the get prompt", async () => {
    const fake = createFakeAuthenticator();
    const c = await created(fake);
    fake.configure({ failure: "cancel_get" });
    expect(
      await confirmPasskey(fake, {
        rpId: RP_ID,
        credentialId: c.credentialId,
        prfSalt: c.prfSalt,
        createdPrf: c.createdPrf,
      }),
    ).toEqual({ ok: false, reason: "cancelled" });
  });

  it("reports failed for any other get error", async () => {
    const fake = createFakeAuthenticator();
    const c = await created(fake);
    fake.configure({ failure: "error_get" });
    expect(
      await confirmPasskey(fake, {
        rpId: RP_ID,
        credentialId: c.credentialId,
        prfSalt: c.prfSalt,
        createdPrf: c.createdPrf,
      }),
    ).toEqual({ ok: false, reason: "failed" });
  });
});

describe("assertPasskey", () => {
  it("calls port.get synchronously when the hostname matches", async () => {
    const fake = createFakeAuthenticator();
    const created = await createPasskey(fake, { rpId: RP_ID });
    if (!created.ok) throw new Error("setup");
    const before = fake.calls.length;
    const pending = assertPasskey(fake, {
      rpId: RP_ID,
      credentialId: created.credentialId,
      prfSalt: created.prfSalt,
      pageHostname: RP_ID,
    });
    expect(fake.calls.length).toBe(before + 1);
    expect(fake.calls[before].method).toBe("get");
    await pending;
  });

  it("returns the PRF output on the matching domain", async () => {
    const fake = createFakeAuthenticator({ createPrf: "results" });
    const created = await createPasskey(fake, { rpId: RP_ID });
    if (!created.ok) throw new Error("setup");
    const result = await assertPasskey(fake, {
      rpId: RP_ID,
      credentialId: created.credentialId,
      prfSalt: created.prfSalt,
      pageHostname: RP_ID,
    });
    expect(result).toEqual({ ok: true, prfOutput: created.createdPrf });
  });

  it("returns wrong_domain and never calls get for another hostname", async () => {
    // Property 10: any hostname other than the rpId sends zero get calls.
    const fake = createFakeAuthenticator();
    const created = await createPasskey(fake, { rpId: RP_ID });
    if (!created.ok) throw new Error("setup");
    const callsBefore = fake.calls.length;
    for (const host of [
      "example.com",
      "revenant.devclef.se.evil.example",
      "REVENANT.DEVCLEF.SE",
      "",
      "localhost",
    ]) {
      const result = await assertPasskey(fake, {
        rpId: RP_ID,
        credentialId: created.credentialId,
        prfSalt: created.prfSalt,
        pageHostname: host,
      });
      expect(result).toEqual({ ok: false, reason: "wrong_domain" });
    }
    expect(fake.calls.length).toBe(callsBefore);
  });

  // Feature: 06-lock-and-unlock, Property 10: a page hostname other than the
  // rpId returns wrong_domain and never reaches get (fast-check numRuns: 100).
  it("Property 10: any other hostname returns wrong_domain with zero get calls", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((host) => host !== RP_ID),
        async (host) => {
          const fake = createFakeAuthenticator();
          const created = await createPasskey(fake, { rpId: RP_ID });
          if (!created.ok) throw new Error("setup");
          const callsBefore = fake.calls.length;

          const result = await assertPasskey(fake, {
            rpId: RP_ID,
            credentialId: created.credentialId,
            prfSalt: created.prfSalt,
            pageHostname: host,
          });

          expect(result).toEqual({ ok: false, reason: "wrong_domain" });
          const getCalls = fake.calls
            .slice(callsBefore)
            .filter((call) => call.method === "get");
          expect(getCalls.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("reports unsupported without calling get when the port is unavailable", async () => {
    const fake = createFakeAuthenticator({ available: false });
    const result = await assertPasskey(fake, {
      rpId: RP_ID,
      credentialId: new Uint8Array(32),
      prfSalt: new Uint8Array(32),
      pageHostname: RP_ID,
    });
    expect(result).toEqual({ ok: false, reason: "unsupported" });
    expect(fake.calls.length).toBe(0);
  });

  it("reports no_prf when get has no PRF result", async () => {
    const fake = createFakeAuthenticator({ getPrf: "none" });
    const created = await createPasskey(fake, { rpId: RP_ID });
    if (!created.ok) throw new Error("setup");
    const result = await assertPasskey(fake, {
      rpId: RP_ID,
      credentialId: created.credentialId,
      prfSalt: created.prfSalt,
      pageHostname: RP_ID,
    });
    expect(result).toEqual({ ok: false, reason: "no_prf" });
  });

  it("reports cancelled and failed for port errors", async () => {
    const fake = createFakeAuthenticator({ failure: "cancel_get" });
    const salt = new Uint8Array(32);
    const id = new Uint8Array(32);
    expect(
      await assertPasskey(fake, {
        rpId: RP_ID,
        credentialId: id,
        prfSalt: salt,
        pageHostname: RP_ID,
      }),
    ).toEqual({ ok: false, reason: "cancelled" });

    fake.configure({ failure: "error_get" });
    expect(
      await assertPasskey(fake, {
        rpId: RP_ID,
        credentialId: id,
        prfSalt: salt,
        pageHostname: RP_ID,
      }),
    ).toEqual({ ok: false, reason: "failed" });
  });
});

describe("Property 9: the PRF check maps port behaviour to the result", () => {
  // Every combination of create PRF, get PRF and get failure, with the expected
  // outcome from R7.3 and R7.4. None of them throws.
  const createPrfs = ["results", "none"] as const;
  const getPrfs = ["results", "none", "short", "mismatch"] as const;
  const failures = [null, "cancel_get", "error_get"] as const;

  for (const createPrf of createPrfs) {
    for (const getPrf of getPrfs) {
      for (const failure of failures) {
        it(`createPrf=${createPrf} getPrf=${getPrf} failure=${failure}`, async () => {
          const fake = createFakeAuthenticator({ createPrf, getPrf: "results" });
          const created = await createPasskey(fake, { rpId: RP_ID });
          if (!created.ok) throw new Error("setup");
          fake.configure({ getPrf, failure });

          const result = await confirmPasskey(fake, {
            rpId: RP_ID,
            credentialId: created.credentialId,
            prfSalt: created.prfSalt,
            createdPrf: created.createdPrf,
          });

          let expected: string;
          if (failure === "cancel_get") expected = "cancelled";
          else if (failure === "error_get") expected = "failed";
          else if (getPrf === "none" || getPrf === "short") expected = "no_prf";
          else if (createPrf === "results" && getPrf === "mismatch")
            expected = "prf_mismatch";
          else expected = "ok";

          if (expected === "ok") {
            expect(result.ok).toBe(true);
          } else {
            expect(result.ok).toBe(false);
            expect(result).toMatchObject({ reason: expected });
            expect("prfOutput" in result).toBe(false);
          }
        });
      }
    }
  }
});
