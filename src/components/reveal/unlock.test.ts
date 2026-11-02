// Unit tests for the unlock helpers (reveal/unlock.ts, design.md
// "Opening_Flow additions" and "The first-async-step rule").
//
// This file is under src/components, so it may not import the crypto barrel
// statically (import-boundary.test.ts), and the crypto-barrel scan allows only
// the two runtime importers. The tests therefore load the crypto sub-modules
// they need with a dynamic `import()`. Those are not the barrel, so the scan
// does not count them. The helpers under test take the crypto functions as
// arguments, so the real implementations are passed straight in.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeBase64url, encodeBase64url } from "@/lib/seal-format";
import {
  noticeForAssertFailure,
  onceOnly,
  readBackupKeyField,
  readUnlockEnvelope,
  startPasskeyAssertion,
  type PasskeyHeader,
} from "./unlock";

const RP_ID = "revenant.devclef.se";

/** The real passkey module, loaded dynamically. */
async function loadPasskey() {
  return import("@/lib/crypto/passkey");
}

/** A fresh fake authenticator, loaded dynamically. */
async function fakePort(
  config: { available?: boolean } = {},
) {
  const { createFakeAuthenticator } = await import(
    "@/lib/crypto/testing/fake-authenticator"
  );
  return createFakeAuthenticator(config);
}

/** A header for the assertion: 32-byte credential ID and 32-byte PRF salt. */
function header(): PasskeyHeader {
  return {
    rpId: RP_ID,
    credentialId: Uint8Array.from({ length: 32 }, (_, i) => i + 1),
    prfSalt: Uint8Array.from({ length: 32 }, (_, i) => 255 - i),
  };
}

describe("startPasskeyAssertion: the port's get is the first async step", () => {
  it("calls the port synchronously, before any await", async () => {
    const passkey = await loadPasskey();
    const port = await fakePort();
    const pending = startPasskeyAssertion(passkey, port, header(), RP_ID);
    // Read the call count before awaiting: the prompt must already be open.
    expect(port.calls.map((c) => c.method)).toEqual(["get"]);
    await pending;
    expect(port.calls).toHaveLength(1);
  });

  it("passes the header's rpId, credential ID and PRF salt to the port", async () => {
    const passkey = await loadPasskey();
    const port = await fakePort();
    const h = header();
    await startPasskeyAssertion(passkey, port, h, RP_ID);
    const options = port.calls[0].options as {
      rpId: string;
      prfSalt: Uint8Array;
      allowCredentialIds: readonly Uint8Array[];
    };
    expect(options.rpId).toBe(RP_ID);
    expect(Array.from(options.prfSalt)).toEqual(Array.from(h.prfSalt));
    expect(Array.from(options.allowCredentialIds[0])).toEqual(
      Array.from(h.credentialId),
    );
  });

  it("returns the PRF output on a matching host", async () => {
    const passkey = await loadPasskey();
    const port = await fakePort();
    const result = await startPasskeyAssertion(passkey, port, header(), RP_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.prfOutput).toHaveLength(32);
    }
  });
});

describe("startPasskeyAssertion: wrong domain never reaches the authenticator", () => {
  it("returns wrong_domain and calls get zero times when the page host differs", async () => {
    const passkey = await loadPasskey();
    const port = await fakePort();
    const result = await startPasskeyAssertion(
      passkey,
      port,
      header(),
      "example.org",
    );
    expect(result).toEqual({ ok: false, reason: "wrong_domain" });
    expect(port.calls).toHaveLength(0);
  });

  it("returns wrong_domain and calls get zero times when there is no page host (node)", async () => {
    const passkey = await loadPasskey();
    const port = await fakePort();
    const result = await startPasskeyAssertion(passkey, port, header());
    expect(result).toEqual({ ok: false, reason: "wrong_domain" });
    expect(port.calls).toHaveLength(0);
  });

  it("returns unsupported and never calls get when the port is unavailable", async () => {
    const passkey = await loadPasskey();
    const port = await fakePort({ available: false });
    const result = await startPasskeyAssertion(passkey, port, header(), RP_ID);
    expect(result).toEqual({ ok: false, reason: "unsupported" });
    expect(port.calls).toHaveLength(0);
  });
});

describe("noticeForAssertFailure", () => {
  it("maps unsupported to no_prf and passes the other four names through", () => {
    expect(noticeForAssertFailure("unsupported")).toBe("no_prf");
    expect(noticeForAssertFailure("no_prf")).toBe("no_prf");
    expect(noticeForAssertFailure("cancelled")).toBe("cancelled");
    expect(noticeForAssertFailure("wrong_domain")).toBe("wrong_domain");
    expect(noticeForAssertFailure("failed")).toBe("failed");
  });
});

describe("readBackupKeyField", () => {
  it("parses a valid key and returns its bytes without any request", async () => {
    const { formatBackupKey, generateBackupKey, parseBackupKey } = await import(
      "@/lib/crypto/backup-key"
    );
    const key = generateBackupKey();
    const card = formatBackupKey(key);
    const result = readBackupKeyField({ parseBackupKey }, card);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(result.key)).toEqual(Array.from(key));
    }
  });

  it("returns mistyped_key for a key that fails the checksum", async () => {
    const { parseBackupKey } = await import("@/lib/crypto/backup-key");
    const result = readBackupKeyField({ parseBackupKey }, "AAAA-AAAA-AAAA");
    expect(result).toEqual({ ok: false, notice: "mistyped_key" });
  });
});

describe("onceOnly: the single automatic re-check", () => {
  it("runs the action on the first call and not again", () => {
    let runs = 0;
    const recheck = onceOnly(() => {
      runs += 1;
    });
    recheck();
    recheck();
    recheck();
    expect(runs).toBe(1);
  });

  it("does not run until it is called", () => {
    let runs = 0;
    onceOnly(() => {
      runs += 1;
    });
    expect(runs).toBe(0);
  });
});

// --- readUnlockEnvelope ----------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(
  here,
  "..",
  "..",
  "lib",
  "seal-format",
  "__fixtures__",
  "golden-v1-envelope.json",
);

type GoldenWrap = { factor: string; nonce: string; wrappedKey: string };
type GoldenEnvelope = {
  wrappedDeks: GoldenWrap[];
  [key: string]: unknown;
};

function golden(): GoldenEnvelope {
  return JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as GoldenEnvelope;
}

/** The golden backup-only envelope with a passkey wrap added after the backup wrap. */
function passkeyEnvelope(): GoldenEnvelope {
  const env = golden();
  const backup = env.wrappedDeks[0];
  return {
    ...env,
    rpId: RP_ID,
    credentialId: encodeBase64url(header().credentialId),
    prfSalt: encodeBase64url(header().prfSalt),
    wrappedDeks: [
      backup,
      { factor: "passkey", nonce: backup.nonce, wrappedKey: backup.wrappedKey },
    ],
  };
}

const SECRET_B64 = encodeBase64url(new Uint8Array(32).fill(7));

describe("readUnlockEnvelope", () => {
  it("reports a backup-only letter with no passkey header", () => {
    const result = readUnlockEnvelope(golden(), SECRET_B64);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.unlock).toEqual({ passkey: null, backup: true });
      expect(result.passkeyHeader).toBeNull();
      expect(Array.from(result.serverSecret)).toEqual(
        Array.from(decodeBase64url(SECRET_B64, 32)),
      );
    }
  });

  it("reports a passkey wrap with the header rpId and decoded credential and salt", () => {
    const result = readUnlockEnvelope(passkeyEnvelope(), SECRET_B64);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.unlock).toEqual({
        passkey: { rpId: RP_ID },
        backup: true,
      });
      expect(result.passkeyHeader?.rpId).toBe(RP_ID);
      expect(Array.from(result.passkeyHeader?.credentialId ?? [])).toEqual(
        Array.from(header().credentialId),
      );
      expect(Array.from(result.passkeyHeader?.prfSalt ?? [])).toEqual(
        Array.from(header().prfSalt),
      );
    }
  });

  it("returns invalid_input when the released secret is not 32 bytes", () => {
    const result = readUnlockEnvelope(
      golden(),
      encodeBase64url(new Uint8Array(8)),
    );
    expect(result).toEqual({ ok: false, kind: "invalid_input" });
  });

  it("returns unsupported_format for an envelope version it does not know", () => {
    const result = readUnlockEnvelope({ formatVersion: 9 }, SECRET_B64);
    expect(result).toEqual({ ok: false, kind: "unsupported_format" });
  });

  it("returns invalid_payload for a v1 header that fails its schema", () => {
    const env = { ...golden(), payloadNonce: "not-base64url-length" };
    const result = readUnlockEnvelope(env, SECRET_B64);
    expect(result).toEqual({ ok: false, kind: "invalid_payload" });
  });
});
