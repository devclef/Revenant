"use client";

/**
 * Opening_Flow effect runner (design.md "Opening_Flow and Reveal", Components
 * table row `useOpeningFlow.ts`).
 *
 * The reducer in `opening-machine.ts` is pure: it holds the state and the
 * gating rules but performs no I/O, crypto, storage or logging. This hook is
 * the thin layer that runs the side effects the current state calls for and
 * feeds each outcome back as a `FlowEvent`. The views render from the state
 * alone. Keeping every effect here is what lets the gating rules (nothing
 * revealed before the record is stored) be tested without a browser.
 *
 * Effects, by state:
 * - `loading`     -> `getLetter(id)`; dispatch LETTER_SEALED / LETTER_OPENABLE /
 *                    LETTER_NOT_PLACED / UNREACHABLE.
 * - `openable`    -> `getSecret(id)`; dispatch SECRET_OK / SECRET_FORBIDDEN /
 *                    UNREACHABLE.
 * - `verifying`   -> `await import("@/lib/crypto")`, `parseBackupKey(
 *                    PUBLIC_DEMO_BACKUP_KEY)` then `openLetter(...)`; dispatch
 *                    OPENED / VERIFICATION_FAILED / OPEN_FAILED. (A demo letter
 *                    is sealed with the public demo key, so the key is fixed,
 *                    not typed.) The envelope header is parsed here (pure
 *                    `@/lib/seal-format`) so the reducer's `Opened` carries the
 *                    `letterId`, `header` and the memory-only key.
 * - `submitting`  -> `postOpening({ letterId, ciphertext, nonce })`; dispatch
 *                    POST_OK / POST_FAILED. The encrypt step happened in
 *                    `submit` (below), which built the sealed bytes.
 *
 * A valid `submit` (R3.4, R8.3, R8.4): `buildRecallRecord(questions, drafts)`,
 * and on `ok` `encryptOpeningRecord(openingKey, letterIdBytes, record)`, then
 * dispatch RECORD_SEALED (which moves the reducer to `submitting`). On an
 * invalid build, dispatch SUBMIT_INVALID with the failing question IDs; the
 * drafts stay as typed. Crypto is loaded ONLY by dynamic `import()`, so it is
 * never evaluated during server rendering or bundled into the server
 * (R14.6).
 *
 * One attempt per mount (R7.1, design.md): a `useRef` guard records which state
 * occurrence already kicked its effect, so React Strict Mode's double effect
 * invoke runs each effect exactly once. A retry (`START` -> `loading`) is a new
 * occurrence and so starts a fresh attempt.
 *
 * Memory only (R7.10): all state is in `useReducer`. This hook writes no
 * storage, no cookies, no URL and never calls `console`. On unmount it marks
 * itself unmounted so a late async result is dropped instead of dispatched into
 * a torn-down component.
 *
 * This module is a client module. It imports the pure reducer and the pure
 * seal-format and recall helpers statically, but `@/lib/crypto` ONLY through a
 * dynamic import inside an effect, which the boundary test requires.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { CryptoModule } from "@/components/live/crypto-module";
import { decodeBase64url, parseEnvelope } from "@/lib/seal-format";
import { buildRecallRecord, type RecallRecordV1 } from "@/lib/recall";
import {
  INITIAL_STATE,
  reduce,
  type FlowEvent,
  type FlowState,
  type OpenFailedKind,
} from "./opening-machine";
import { getLetter, getSecret, postOpening } from "./api";
import {
  noticeForAssertFailure,
  readBackupKeyField,
  readUnlockEnvelope,
  startPasskeyAssertion,
  type AuthenticatorPort,
  type BackupKeyBytes,
  type PasskeyHeader,
  type UnlockControls,
} from "@/components/live/unlock";

/** The 16 ID bytes of a letter. */
const LETTER_ID_BYTES = 16;

/**
 * Options for `useOpeningFlow`. The default `keySource` is `"demo"`, which runs
 * the fixed demo key with no user input and is exactly the behaviour on main.
 * `"user"` is the live letter: the reader unlocks with a passkey or a backup
 * key. `port` overrides the browser authenticator (tests pass a fake).
 */
export type OpeningFlowOptions = {
  keySource?: "demo" | "user";
  port?: AuthenticatorPort;
};

/** Live-letter controls. Defined only in `"user"` mode. */
export type LiveFlow = {
  /** True when the letter is a demo letter (the route sent `demo: true`). */
  demo: boolean;
  /** The key-step controls. */
  unlock: UnlockControls;
};

/** The one unlock factor the reader has supplied for the next `unlocking` run. */
type UnlockFactor =
  | { kind: "passkey"; prfOutput: Uint8Array }
  | { kind: "backup"; backupKey: BackupKeyBytes };

/** What the hook returns: the current state plus the handlers the views call. */
export type OpeningFlow = {
  /** The current Opening_Flow state; views select a screen by `state.tag`. */
  state: FlowState;
  /** Retry from the start (sealed countdown finished, or an unreachable error). */
  retry: () => void;
  /** The judge pressed "Begin" on the verification statement. */
  begin: () => void;
  /** The judge edited one recall answer's text. */
  editDraft: (id: string, text: string) => void;
  /** The judge toggled one recall answer's "No answer" control. */
  toggleNoAnswer: (id: string, noAnswer: boolean) => void;
  /** The judge submitted the recall answers. Validates, encrypts, then posts. */
  submit: () => void;
  /** Retry the post of the same sealed record after a failed submit (R8.7). */
  retryPost: () => void;
  /** Reveal pacing: show the next stage. */
  advance: () => void;
  /** Reveal pacing: show every stage at once. */
  showAll: () => void;
  /** Live-letter controls. `undefined` in demo mode. */
  live?: LiveFlow;
};

/**
 * Drive the Opening_Flow for one demo letter.
 *
 * @param letterId the letter's public ID, used for every API call and as the
 *   AAD when encrypting the recall record. The same value the persona list
 *   carried; this hook never reads it from the URL or anywhere else.
 */
export function useOpeningFlow(
  letterId: string,
  options: OpeningFlowOptions = {},
): OpeningFlow {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE);
  const keySource = options.keySource ?? "demo";
  const port = options.port;

  // Live-letter state (user mode only). `demo` comes from the letter route;
  // `cryptoReady` turns the key controls on once the barrel has loaded.
  const [demo, setDemo] = useState(false);
  const [cryptoReady, setCryptoReady] = useState(false);
  // Memory-only refs (R7.10): the released secret, the passkey header bytes,
  // the loaded barrel and the one factor for the next unlock. None is in state.
  const cryptoRef = useRef<CryptoModule | null>(null);
  const secretRef = useRef<Uint8Array | null>(null);
  const passkeyHeaderRef = useRef<PasskeyHeader | null>(null);
  const factorRef = useRef<UnlockFactor | null>(null);

  // Dropped on unmount so a late async result is never dispatched into a
  // torn-down component (and so nothing runs after the user leaves).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A dispatch that no-ops once unmounted.
  const safeDispatch = useCallback((event: FlowEvent) => {
    if (mounted.current) {
      dispatch(event);
    }
  }, []);

  // --- One-attempt-per-occurrence guard -------------------------------------
  //
  // Each auto-running effect (`loading`, `openable`, `verifying`, `submitting`)
  // must fire exactly once for a given entry into that state, even though React
  // Strict Mode invokes effects twice in development. `attempt` counts entries
  // into `loading` (a retry bumps it); the guard key combines that count with
  // the state tag, so every distinct effect occurrence has a unique key and is
  // started at most once.
  const attempt = useRef(0);
  const prevTag = useRef<FlowState["tag"] | null>(null);
  const started = useRef<Set<string>>(new Set());
  // Counts entries into `unlocking`, so a second unlock (after a wrong key) is a
  // new occurrence and its effect runs again.
  const unlockCount = useRef(0);

  if (state.tag === "loading" && prevTag.current !== "loading") {
    attempt.current += 1;
  }
  if (state.tag === "unlocking" && prevTag.current !== "unlocking") {
    unlockCount.current += 1;
  }
  prevTag.current = state.tag;

  const occurrence = `${attempt.current}:${unlockCount.current}:${state.tag}`;
  const claimOccurrence = (): boolean => {
    if (started.current.has(occurrence)) {
      return false;
    }
    started.current.add(occurrence);
    return true;
  };

  // --- loading: fetch the letter --------------------------------------------
  useEffect(() => {
    if (state.tag !== "loading" || !claimOccurrence()) {
      return;
    }
    void (async () => {
      const result = await getLetter(letterId);
      if (keySource === "user" && "demo" in result && result.demo === true) {
        if (mounted.current) setDemo(true);
      }
      switch (result.outcome) {
        case "sealed":
          safeDispatch({ type: "LETTER_SEALED", opensAt: result.opensAt });
          break;
        case "openable":
          safeDispatch({
            type: "LETTER_OPENABLE",
            envelope: result.envelope,
            envelopeHash: result.envelopeHash,
          });
          break;
        case "not_placed":
          safeDispatch({ type: "LETTER_NOT_PLACED" });
          break;
        case "unreachable":
          safeDispatch({ type: "UNREACHABLE" });
          break;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tag, occurrence]);

  // --- openable: parse the demo key, then fetch the secret ------------------
  useEffect(() => {
    if (state.tag !== "openable" || !claimOccurrence()) {
      return;
    }
    const envelope = state.envelope;
    void (async () => {
      const result = await getSecret(letterId);
      switch (result.outcome) {
        case "ok": {
          if (keySource === "user") {
            // Live letter: the secret is released, so read the wraps and wait
            // for the reader's key. No secret goes into state.
            const unlock = readUnlockEnvelope(envelope, result.serverSecret);
            if (!unlock.ok) {
              safeDispatch({ type: "OPEN_FAILED", kind: unlock.kind });
              break;
            }
            secretRef.current = unlock.serverSecret;
            passkeyHeaderRef.current = unlock.passkeyHeader;
            safeDispatch({ type: "NEEDS_KEY", unlock: unlock.unlock });
            break;
          }
          safeDispatch({ type: "SECRET_OK" });
          break;
        }
        case "forbidden":
          safeDispatch({ type: "SECRET_FORBIDDEN", opensAt: result.opensAt });
          break;
        case "unreachable":
          safeDispatch({ type: "UNREACHABLE" });
          break;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tag, occurrence]);

  // --- verifying: dynamic-import crypto, then openLetter --------------------
  //
  // The secret request already succeeded, so we fetch it again here only to
  // hand the raw bytes to `openLetter`; the reducer never carries secret bytes.
  // Crypto loads by dynamic import so it is browser-only (R14.6).
  const verifyState = state.tag === "verifying" ? state : null;
  const openableSnapshot = useRef<{
    envelope: unknown;
    envelopeHash: string;
  } | null>(null);
  if (state.tag === "openable") {
    openableSnapshot.current = {
      envelope: state.envelope,
      envelopeHash: state.envelopeHash,
    };
  }

  useEffect(() => {
    if (verifyState === null || !claimOccurrence()) {
      return;
    }
    const snapshot = openableSnapshot.current;
    void (async () => {
      // Re-read the released secret bytes for openLetter. The reducer holds no
      // secret; this keeps secret material out of the serialisable state.
      const secretResult = await getSecret(letterId);
      if (secretResult.outcome !== "ok") {
        safeDispatch({ type: "UNREACHABLE" });
        return;
      }
      if (snapshot === null) {
        safeDispatch({ type: "UNREACHABLE" });
        return;
      }

      // Parse the envelope header once (pure, browser-safe) to read the fields
      // the reducer's `Opened` needs and to recover the 16 ID bytes for the
      // opening-record AAD. A header that will not parse cannot be opened.
      const parsed = parseEnvelope(snapshot.envelope);
      if (!parsed.ok) {
        const kind: OpenFailedKind =
          parsed.error === "unsupported_format"
            ? "unsupported_format"
            : "invalid_payload";
        safeDispatch({ type: "OPEN_FAILED", kind });
        return;
      }
      const header = parsed.value;

      const crypto = await import("@/lib/crypto");

      // The released secret is base64url of 32 bytes; decode with the pure,
      // browser-safe seal-format codec. The bytes never touch storage or a log.
      let serverSecret: Uint8Array;
      try {
        serverSecret = decodeBase64url(secretResult.serverSecret, 32);
      } catch {
        safeDispatch({ type: "OPEN_FAILED", kind: "invalid_input" });
        return;
      }

      const parsedKey = crypto.parseBackupKey(crypto.PUBLIC_DEMO_BACKUP_KEY);
      if (!parsedKey.ok) {
        // The public demo key is a fixed, valid card string; a parse failure
        // means a broken build, not a bad letter. Fail closed with no payload.
        safeDispatch({ type: "OPEN_FAILED", kind: "invalid_input" });
        return;
      }

      const result = await crypto.openLetter({
        envelope: snapshot.envelope,
        envelopeHash: snapshot.envelopeHash,
        serverSecret,
        backupKey: parsedKey.key,
      });

      if (!result.ok) {
        if (result.error.kind === "verification_failed") {
          safeDispatch({ type: "VERIFICATION_FAILED" });
          return;
        }
        safeDispatch({ type: "OPEN_FAILED", kind: result.error.kind });
        return;
      }

      safeDispatch({
        type: "OPENED",
        opened: {
          letterId,
          header: { sealedAt: header.sealedAt, opensAt: header.opensAt },
          payload: result.payload,
          openingKey: result.openingKey,
        },
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyState, occurrence]);

  // --- awaiting_key: preload the crypto barrel (user mode) ------------------
  //
  // The passkey prompt must start in the same tick as its click, so the barrel
  // is loaded before the reader can press anything. The controls stay disabled
  // until `cryptoReady` (R15.3, R17.2). Demo mode never reaches this effect.
  const awaitingKey = state.tag === "awaiting_key";
  useEffect(() => {
    if (keySource !== "user" || !awaitingKey || cryptoRef.current !== null) {
      return;
    }
    void import("@/lib/crypto").then(
      (module) => {
        cryptoRef.current = module;
        if (mounted.current) setCryptoReady(true);
      },
      () => {
        // A failed load leaves the controls disabled. No payload is involved.
      },
    );
  }, [keySource, awaitingKey]);

  // --- unlocking: open with the factor the reader supplied (user mode) ------
  const unlockState = state.tag === "unlocking" ? state : null;
  useEffect(() => {
    if (keySource !== "user" || unlockState === null || !claimOccurrence()) {
      return;
    }
    const factor = factorRef.current;
    factorRef.current = null;
    const secret = secretRef.current;
    const { envelope, envelopeHash } = unlockState;
    void (async () => {
      if (factor === null || secret === null) {
        safeDispatch({ type: "OPEN_FAILED", kind: "invalid_input" });
        return;
      }
      const parsed = parseEnvelope(envelope);
      if (!parsed.ok) {
        const kind: OpenFailedKind =
          parsed.error === "unsupported_format"
            ? "unsupported_format"
            : "invalid_payload";
        safeDispatch({ type: "OPEN_FAILED", kind });
        return;
      }
      const header = parsed.value;

      const crypto = await import("@/lib/crypto");
      const result = await crypto.openLetter(
        factor.kind === "passkey"
          ? {
              envelope,
              envelopeHash,
              serverSecret: secret.slice(),
              passkey: { prfOutput: factor.prfOutput },
            }
          : {
              envelope,
              envelopeHash,
              serverSecret: secret.slice(),
              backupKey: factor.backupKey,
            },
      );

      if (!result.ok) {
        if (result.error.kind === "verification_failed") {
          safeDispatch({ type: "VERIFICATION_FAILED" });
          return;
        }
        if (result.error.kind === "wrong_key") {
          safeDispatch({ type: "KEY_REJECTED", factor: factor.kind });
          return;
        }
        safeDispatch({ type: "OPEN_FAILED", kind: result.error.kind });
        return;
      }

      safeDispatch({
        type: "OPENED",
        opened: {
          letterId,
          header: { sealedAt: header.sealedAt, opensAt: header.opensAt },
          payload: result.payload,
          openingKey: result.openingKey,
        },
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockState, occurrence]);

  // --- submitting: post the sealed record -----------------------------------
  useEffect(() => {
    if (state.tag !== "submitting" || !claimOccurrence()) {
      return;
    }
    const { opened, sealed } = state;
    void (async () => {
      const result = await postOpening({
        letterId: opened.letterId,
        ciphertext: sealed.ciphertext,
        nonce: sealed.nonce,
      });
      safeDispatch(
        result.outcome === "ok"
          ? { type: "POST_OK" }
          : { type: "POST_FAILED" },
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tag, occurrence]);

  // --- view handlers --------------------------------------------------------

  const retry = useCallback(() => safeDispatch({ type: "START" }), [safeDispatch]);
  const begin = useCallback(() => safeDispatch({ type: "BEGIN" }), [safeDispatch]);
  const editDraft = useCallback(
    (id: string, text: string) => safeDispatch({ type: "EDIT_DRAFT", id, text }),
    [safeDispatch],
  );
  const toggleNoAnswer = useCallback(
    (id: string, noAnswer: boolean) =>
      safeDispatch({ type: "TOGGLE_NO_ANSWER", id, noAnswer }),
    [safeDispatch],
  );
  const retryPost = useCallback(
    () => safeDispatch({ type: "RETRY_POST" }),
    [safeDispatch],
  );
  const advance = useCallback(() => safeDispatch({ type: "ADVANCE" }), [safeDispatch]);
  const showAll = useCallback(() => safeDispatch({ type: "SHOW_ALL" }), [safeDispatch]);

  // Passkey prompt. Everything before the port call is synchronous, and
  // `startPasskeyAssertion` is called without `await`, so the port's `get` runs
  // in the same tick as the click (the first-async-step rule).
  const passkeyUnlock = useCallback(() => {
    const crypto = cryptoRef.current;
    const header = passkeyHeaderRef.current;
    if (crypto === null || header === null) {
      return;
    }
    const selectedPort = port ?? crypto.browserAuthenticatorPort;
    startPasskeyAssertion(crypto, selectedPort, header).then(
      (result) => {
        if (result.ok) {
          factorRef.current = { kind: "passkey", prfOutput: result.prfOutput };
          safeDispatch({ type: "UNLOCK" });
        } else {
          safeDispatch({
            type: "KEY_NOTICE",
            notice: noticeForAssertFailure(result.reason),
          });
        }
      },
      () => safeDispatch({ type: "KEY_NOTICE", notice: "failed" }),
    );
  }, [port, safeDispatch]);

  // Backup key field. Parsed locally; a mistyped key sends no request.
  const backupUnlock = useCallback(
    (text: string) => {
      const crypto = cryptoRef.current;
      if (crypto === null) {
        return;
      }
      const read = readBackupKeyField(crypto, text);
      if (read.ok) {
        factorRef.current = { kind: "backup", backupKey: read.key };
        safeDispatch({ type: "UNLOCK" });
      } else {
        safeDispatch({ type: "KEY_NOTICE", notice: read.notice });
      }
    },
    [safeDispatch],
  );

  const live: LiveFlow | undefined =
    keySource === "user"
      ? {
          demo,
          unlock: {
            ready: cryptoReady,
            passkey: passkeyUnlock,
            backup: backupUnlock,
          },
        }
      : undefined;

  // Submit validates then encrypts (R3.4, R8.3, R8.4). It reads the live state
  // through a ref so the single stable callback always sees the current drafts.
  const stateRef = useRef(state);
  stateRef.current = state;

  const submit = useCallback(() => {
    const current = stateRef.current;
    if (current.tag !== "recall") {
      return;
    }
    const { opened, drafts } = current;
    const built = buildRecallRecord(opened.payload.recall_questions, drafts);
    if (!built.ok) {
      safeDispatch({ type: "SUBMIT_INVALID", invalid: built.invalid });
      return;
    }
    const record: RecallRecordV1 = built.record;
    // The opening-record AAD is the letter's 16 ID bytes, the same bytes
    // `openLetter` used. The public `letterId` is the canonical base64url of
    // those 16 bytes, so decode it here rather than carrying bytes in state.
    const letterIdBytes = decodeBase64url(opened.letterId, LETTER_ID_BYTES);
    void (async () => {
      const crypto = await import("@/lib/crypto");
      const sealed = await crypto.encryptOpeningRecord(
        opened.openingKey,
        letterIdBytes,
        record,
      );
      safeDispatch({ type: "RECORD_SEALED", record, sealed });
    })();
  }, [safeDispatch]);

  return {
    state,
    retry,
    begin,
    editDraft,
    toggleNoAnswer,
    submit,
    retryPost,
    advance,
    showAll,
    live,
  };
}
