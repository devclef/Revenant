/**
 * Unlock helpers for the user key-source flow (spec 06, design.md
 * "Opening_Flow additions", R17.x).
 *
 * Everything here is a plain function. The crypto barrel is passed in as an
 * argument (typed through `live/crypto-module.ts`, which holds only a type), so
 * this file never imports `@/lib/crypto`, statically or dynamically. The effect
 * runner in `useOpeningFlow.ts` loads the barrel and passes it in.
 *
 * - `startPasskeyAssertion` calls `assertPasskey` synchronously. Its first
 *   action is the port's `get`, so a click handler that calls it without `await`
 *   starts the WebAuthn prompt in the same tick (the first-async-step rule).
 * - `noticeForAssertFailure` maps a passkey failure to the notice shown on the
 *   key step. An authenticator with no PRF output is shown as `no_prf`.
 * - `readBackupKeyField` parses a typed or pasted backup key. It sends no
 *   request. A mistyped key returns `mistyped_key` and no bytes.
 * - `readUnlockEnvelope` reads the header of an openable envelope once the
 *   Server_Secret has been released and works out which unlock factors it
 *   accepts. It also decodes the bytes the passkey assertion needs.
 * - `onceOnly` wraps an action so it runs at most once. The Letter_Page uses it
 *   for the single automatic re-check when the countdown reaches zero.
 */

import type { CryptoModule } from "@/components/live/crypto-module";
import { decodeBase64url, parseEnvelope } from "@/lib/seal-format";
import type { KeyNotice, OpenFailedKind, UnlockInfo } from "@/components/reveal/opening-machine";

/** The authenticator port the crypto barrel uses. Taken from `assertPasskey`. */
export type AuthenticatorPort = Parameters<CryptoModule["assertPasskey"]>[0];

/** A validated backup key, as `parseBackupKey` returns it. */
export type BackupKeyBytes = Extract<
  ReturnType<CryptoModule["parseBackupKey"]>,
  { ok: true }
>["key"];

/** The part of the crypto barrel the unlock helpers use. */
export type UnlockCrypto = Pick<CryptoModule, "assertPasskey" | "parseBackupKey">;

/** The controls the key step renders. The hook builds one per flow. */
export interface UnlockControls {
  /** False until `@/lib/crypto` has loaded. The controls stay disabled. */
  ready: boolean;
  /** Start the passkey prompt. Wired straight to the button's `onClick`. */
  passkey: () => void;
  /** Read a typed or pasted backup key and unlock with it. */
  backup: (text: string) => void;
}

/** The bytes a passkey assertion needs, all decoded from the envelope header. */
export type PasskeyHeader = {
  rpId: string;
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
};

/** The reasons `assertPasskey` can fail. */
export type AssertFailureReason =
  | "unsupported"
  | "cancelled"
  | "no_prf"
  | "wrong_domain"
  | "failed";

/**
 * Start the passkey assertion. The port's `get` is the first async step, and it
 * is called synchronously here, so the caller must not `await` anything before
 * this call. A page whose host is not the header's `rpId` gets `wrong_domain`
 * and the port is never called.
 *
 * `pageHostname` is only for tests. Without it the function reads
 * `location.hostname`, as `assertPasskey` does.
 */
export function startPasskeyAssertion(
  crypto: Pick<CryptoModule, "assertPasskey">,
  port: AuthenticatorPort,
  header: PasskeyHeader,
  pageHostname?: string,
): ReturnType<CryptoModule["assertPasskey"]> {
  return crypto.assertPasskey(port, {
    rpId: header.rpId,
    credentialId: header.credentialId,
    prfSalt: header.prfSalt,
    ...(pageHostname === undefined ? {} : { pageHostname }),
  });
}

/**
 * Map a failed passkey assertion to the key-step notice. An authenticator with
 * no PRF support is reported as `no_prf`, the same message as a PRF miss.
 */
export function noticeForAssertFailure(reason: AssertFailureReason): KeyNotice {
  switch (reason) {
    case "unsupported":
    case "no_prf":
      return "no_prf";
    case "cancelled":
      return "cancelled";
    case "wrong_domain":
      return "wrong_domain";
    case "failed":
      return "failed";
  }
}

/**
 * Parse a typed or pasted backup key. Groups, dashes, spaces and letter case are
 * all accepted by `parseBackupKey`. Any other input is `mistyped_key`, and the
 * field keeps what the user typed. No request is made.
 */
export function readBackupKeyField(
  crypto: Pick<CryptoModule, "parseBackupKey">,
  text: string,
):
  | { ok: true; key: BackupKeyBytes }
  | { ok: false; notice: "mistyped_key" } {
  const parsed = crypto.parseBackupKey(text);
  if (parsed.ok) {
    return { ok: true, key: parsed.key };
  }
  return { ok: false, notice: "mistyped_key" };
}

/** The result of reading an openable envelope in user mode. */
export type UnlockEnvelope =
  | {
      ok: true;
      /** The 32-byte Server_Secret, decoded. Kept in a ref, never in state. */
      serverSecret: Uint8Array;
      unlock: UnlockInfo;
      /** Present exactly when the envelope has a passkey wrap. */
      passkeyHeader: PasskeyHeader | null;
    }
  | { ok: false; kind: OpenFailedKind };

/**
 * Read an openable envelope in user mode, after the Server_Secret is released.
 *
 * It parses the header (a parse failure maps to the same kinds the verifying
 * step uses), decodes the released secret, and builds the `UnlockInfo` from the
 * wraps. A passkey wrap also yields the decoded `rpId`, credential ID and PRF
 * salt. The parsed secret and header bytes are returned for the caller to keep.
 */
export function readUnlockEnvelope(
  envelope: unknown,
  serverSecretBase64url: string,
): UnlockEnvelope {
  const parsed = parseEnvelope(envelope);
  if (!parsed.ok) {
    return {
      ok: false,
      kind:
        parsed.error === "unsupported_format"
          ? "unsupported_format"
          : "invalid_payload",
    };
  }
  const header = parsed.value;

  let serverSecret: Uint8Array;
  try {
    serverSecret = decodeBase64url(serverSecretBase64url, 32);
  } catch {
    return { ok: false, kind: "invalid_input" };
  }

  const hasPasskey = header.wrappedDeks.some((w) => w.factor === "passkey");
  const hasBackup = header.wrappedDeks.some((w) => w.factor === "backup");

  let passkeyHeader: PasskeyHeader | null = null;
  if (hasPasskey) {
    if (
      header.rpId === undefined ||
      header.credentialId === undefined ||
      header.prfSalt === undefined
    ) {
      return { ok: false, kind: "invalid_payload" };
    }
    try {
      passkeyHeader = {
        rpId: header.rpId,
        credentialId: decodeBase64url(header.credentialId),
        prfSalt: decodeBase64url(header.prfSalt, 32),
      };
    } catch {
      return { ok: false, kind: "invalid_payload" };
    }
  }

  return {
    ok: true,
    serverSecret,
    unlock: {
      passkey: passkeyHeader === null ? null : { rpId: passkeyHeader.rpId },
      backup: hasBackup,
    },
    passkeyHeader,
  };
}

/**
 * Wrap an action so the first call runs it and every later call does nothing.
 * The Letter_Page uses it for the single automatic re-check at zero: a second
 * countdown reaching zero in the same page load does not fetch again.
 */
export function onceOnly(action: () => void): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    action();
  };
}
