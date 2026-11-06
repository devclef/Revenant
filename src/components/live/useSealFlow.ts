// Glue between the seal reducer and the sealing runner (spec 06-lock-and-unlock,
// design.md "Seal_Page state machine"). It owns the refs for the passkey
// results and the backup key, guards double presses, and dispatches reducer
// events.
//
// Nothing here is stored or logged. The refs hold secret bytes only in memory,
// and they are cleared when the flow reaches a terminal state, declines the
// backup key or retries.

import { useCallback, useReducer, useRef, useState } from "react";

import {
  pressConfirm,
  pressCreate,
  sealWithBackupKey,
  sealWithPasskey,
  type BackupKey,
  type Confirmed,
  type Created,
  type SealDeps,
  type SealDraft,
} from "./seal-runner";
import { INITIAL_SEAL_STATE, sealReducer, type SealEvent, type SealState } from "./seal-machine";
import { checkRealOpening } from "./real-opening";

export interface SealFlow {
  state: SealState;
  onCreatePress: () => void;
  onConfirmPress: () => void;
  onFallbackStart: () => void;
  onFallbackSealPress: () => void;
  onFallbackDecline: () => void;
  onRetry: () => void;
  /**
   * Reads the backup key as printed on the card, or null when no key is held.
   * The text lives in a ref, not in React state; call this during render. The
   * flow re-renders when a key is set or cleared, so the read is current.
   */
  getBackupKeyText: () => string | null;
}

/**
 * The sealing flow for one letter. `deps` is null until the crypto module has
 * loaded; presses are ignored until it is set. `draft` is read at the Confirm_
 * Press, so the letter text is the one on screen at that moment.
 */
export function useSealFlow(deps: SealDeps | null, draft: SealDraft): SealFlow {
  const [state, dispatch] = useReducer(sealReducer, INITIAL_SEAL_STATE);
  // The phase as the reducer sees it right now. Presses check this, not the
  // rendered state, so a second press before a re-render is still refused.
  const phase = useRef<SealState>(INITIAL_SEAL_STATE);
  const inFlight = useRef(false);
  const created = useRef<Created | null>(null);
  const confirmed = useRef<Confirmed | null>(null);
  // The backup key bytes, set at FALLBACK_START and cleared when the fallback
  // ends (declined, sealed or failed) or the flow retries.
  const backupKey = useRef<BackupKey | null>(null);
  // The printed form of the same key. It is held in a ref, not in state, so
  // the key text never sits in React state. Only a boolean flag is in state,
  // and it changes only to make React re-render when a key is set or cleared.
  const backupKeyText = useRef<string | null>(null);
  const [, setBackupKeyHeld] = useState(false);

  /** Stores a generated key in the refs and flags the re-render. */
  const holdBackupKey = useCallback((bytes: BackupKey, text: string) => {
    backupKey.current = bytes;
    backupKeyText.current = text;
    setBackupKeyHeld(true);
  }, []);

  /** Drops the backup key and its printed text from the refs and the flag. */
  const clearBackupKey = useCallback(() => {
    backupKey.current = null;
    backupKeyText.current = null;
    setBackupKeyHeld(false);
  }, []);

  /** Reads the printed key at render time. Stable identity. */
  const getBackupKeyText = useCallback((): string | null => backupKeyText.current, []);

  const send = useCallback((event: SealEvent) => {
    phase.current = sealReducer(phase.current, event);
    dispatch(event);
  }, []);

  const onCreatePress = useCallback(() => {
    if (deps === null || inFlight.current || phase.current.tag !== "write") return;
    inFlight.current = true;
    send({ type: "CREATE_PRESS" });
    // Real_Letter: a date that became too early is refused before the passkey
    // prompt, so no passkey is made for it.
    const check = draft.real !== undefined ? checkRealOpening(draft.real, deps.now()) : null;
    if (check !== null && !check.ok) {
      send({ type: "FAILED", kind: check.kind, passkeyCreated: false });
      inFlight.current = false;
      return;
    }
    void pressCreate(deps, check !== null && check.ok ? check.userName : undefined)
      .then((step) => {
        if (step.ok) {
          created.current = step.created;
          send({ type: "CREATED" });
        } else {
          send(step.event);
        }
      })
      .catch(() => {
        send({ type: "FAILED", kind: "server", passkeyCreated: false });
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [deps, draft, send]);

  const onConfirmPress = useCallback(() => {
    const createdKey = created.current;
    if (deps === null || inFlight.current || phase.current.tag !== "created" || createdKey === null) {
      return;
    }
    inFlight.current = true;
    send({ type: "CONFIRM_PRESS" });

    const run = async (): Promise<void> => {
      try {
        // Real_Letter: the same date check as the Create_Press, before the
        // second prompt. The passkey already exists, so passkeyCreated is true.
        if (draft.real !== undefined) {
          const check = checkRealOpening(draft.real, deps.now());
          if (!check.ok) {
            send({ type: "FAILED", kind: check.kind, passkeyCreated: true });
            return;
          }
        }
        const step = await pressConfirm(deps, createdKey);
        if (!step.ok) {
          send(step.event);
          return;
        }
        confirmed.current = step.confirmed;
        send({ type: "CONFIRMED" });
        // The optional backup wrap (R21.1). Generated here, at the seal step,
        // only when the visitor ticked the card box. It stays in the ref and
        // the printed text so the backup key card can show it after sealing.
        let backupKeyForSeal: BackupKey | undefined;
        if (draft.backupCard === true) {
          const bytes = deps.crypto.generateBackupKey();
          holdBackupKey(bytes, deps.crypto.formatBackupKey(bytes));
          backupKeyForSeal = bytes;
        }
        const outcome = await sealWithPasskey(deps, {
          draft,
          confirmed: step.confirmed,
          ...(backupKeyForSeal !== undefined ? { backupKey: backupKeyForSeal } : {}),
          onPrepared: () => send({ type: "PREPARED" }),
        });
        // A failed seal keeps nothing: the key is dropped with the attempt.
        if (!outcome.ok) clearBackupKey();
        send(outcome.event);
      } catch {
        clearBackupKey();
        send({ type: "FAILED", kind: "server", passkeyCreated: true });
      } finally {
        // Terminal either way: the next attempt starts from a new passkey.
        created.current = null;
        confirmed.current = null;
        inFlight.current = false;
      }
    };
    void run();
  }, [clearBackupKey, deps, draft, holdBackupKey, send]);

  /**
   * Starts the backup-key fallback. The key is generated here, from the loaded
   * module, and only once the reducer has accepted FALLBACK_START.
   */
  const onFallbackStart = useCallback(() => {
    if (deps === null || phase.current.tag !== "cannot_lock") return;
    const bytes = deps.crypto.generateBackupKey();
    holdBackupKey(bytes, deps.crypto.formatBackupKey(bytes));
    send({ type: "FALLBACK_START" });
  }, [deps, holdBackupKey, send]);

  /** Declines the fallback. Drops the key and seals nothing; no request is sent. */
  const onFallbackDecline = useCallback(() => {
    if (phase.current.tag !== "fallback_key") return;
    clearBackupKey();
    send({ type: "FALLBACK_DECLINE" });
  }, [clearBackupKey, send]);

  /** Seals with the backup key only. Uses the same draft as the passkey path. */
  const onFallbackSealPress = useCallback(() => {
    const key = backupKey.current;
    if (deps === null || inFlight.current || phase.current.tag !== "fallback_key" || key === null) {
      return;
    }
    inFlight.current = true;
    send({ type: "FALLBACK_SEAL_PRESS" });

    const run = async (): Promise<void> => {
      let sealed = false;
      try {
        const outcome = await sealWithBackupKey(deps, {
          draft,
          backupKey: key,
          onPrepared: () => send({ type: "PREPARED" }),
        });
        sealed = outcome.ok;
        send(outcome.event);
      } catch {
        send({ type: "FAILED", kind: "server", passkeyCreated: false });
      } finally {
        // A failed seal keeps nothing. A sealed letter keeps the key, so the
        // backup key card can show it until the judge leaves the page (R21.3).
        if (!sealed) clearBackupKey();
        inFlight.current = false;
      }
    };
    void run();
  }, [clearBackupKey, deps, draft, send]);

  const onRetry = useCallback(() => {
    if (inFlight.current) return;
    created.current = null;
    confirmed.current = null;
    clearBackupKey();
    send({ type: "RETRY" });
  }, [clearBackupKey, send]);

  return {
    state,
    onCreatePress,
    onConfirmPress,
    onFallbackStart,
    onFallbackSealPress,
    onFallbackDecline,
    onRetry,
    getBackupKeyText,
  };
}
