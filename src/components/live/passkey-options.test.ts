// Feature: 09-demo-polish, P10.4: the passkey calls leave the choice of
// authenticator to the browser. createPasskey, confirmPasskey and assertPasskey
// must not send an authenticatorAttachment or hints, at any depth, so the
// browser can offer "use a phone or tablet" (see the sealing screen copy).

import { describe, expect, it } from "vitest";

// lib/crypto is loaded with dynamic import() only: the import-boundary test
// forbids a static import from src/components.
const loadPasskey = () => import("@/lib/crypto/passkey");
const loadFake = () => import("@/lib/crypto/testing/fake-authenticator");

const RP_ID = "revenant.devclef.se";

const FORBIDDEN_KEYS = ["authenticatorAttachment", "hints"];

/** Every object key found at any depth of a value. */
function allKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      out.push(key);
      allKeys(inner, out);
    }
  }
  return out;
}

describe("passkey calls send no authenticatorAttachment and no hints (P10.4)", () => {
  it("createPasskey sends neither key at any depth", async () => {
    const { createPasskey } = await loadPasskey();
    const { createFakeAuthenticator } = await loadFake();
    const fake = createFakeAuthenticator();
    await createPasskey(fake, { rpId: RP_ID });
    const keys = allKeys(fake.calls[0].options);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("confirmPasskey sends neither key at any depth", async () => {
    const { createPasskey, confirmPasskey } = await loadPasskey();
    const { createFakeAuthenticator } = await loadFake();
    const fake = createFakeAuthenticator();
    const created = await createPasskey(fake, { rpId: RP_ID });
    if (!created.ok) throw new Error("create failed in the fake");
    await confirmPasskey(fake, {
      rpId: RP_ID,
      credentialId: created.credentialId,
      prfSalt: created.prfSalt,
      createdPrf: created.createdPrf,
    });
    const confirmCall = fake.calls[fake.calls.length - 1];
    expect(confirmCall.method).toBe("get");
    const keys = allKeys(confirmCall.options);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("assertPasskey sends neither key at any depth", async () => {
    const { createPasskey, assertPasskey } = await loadPasskey();
    const { createFakeAuthenticator } = await loadFake();
    const fake = createFakeAuthenticator();
    const created = await createPasskey(fake, { rpId: RP_ID });
    if (!created.ok) throw new Error("create failed in the fake");
    await assertPasskey(fake, {
      rpId: RP_ID,
      credentialId: created.credentialId,
      prfSalt: created.prfSalt,
      pageHostname: RP_ID,
    });
    const assertCall = fake.calls[fake.calls.length - 1];
    expect(assertCall.method).toBe("get");
    const keys = allKeys(assertCall.options);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
