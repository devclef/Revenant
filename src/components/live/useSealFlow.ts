// Glue between the seal reducer and the sealing runner (spec 06-lock-and-unlock,
// design.md "Seal_Page state machine"). It owns the refs for the passkey
// results and the backup key, guards double presses, and dispatches reducer
// events. The Backup_Fallback handlers are no-op stubs until that task lands.
//
// Nothing here is stored or logged. The refs hold secret bytes only in memory,
// and they are cleared when the flow reaches a terminal state or retries.

import { useCallback, useReducer, useRef, useState } from "react";

import {
  pressConfirm,
  pressCreate,
  sealWithPasskey,
  type Confirmed,
  type Created,
  type SealDeps,
  type SealDraft,
} from "./seal-runner";
import { INITIAL_SEAL_STATE, sealReducer, type SealEvent, type SealState } from "./seal-machine";

export interface SealFlow {
  state: SealState;
  onCreatePress: () => void;
  onConfirmPress: () => void;
  onFallbackStart: () => void;
  onFallbackSealPress: () => void;
  onFallbackDecline: () => void;
  onRetry: () => void;
  backupKeyText: string | null;
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
  // Reserved for the Backup_Fallback; cleared with the other refs on retry.
  const backupKey = useRef<Uint8Array | null>(null);
  const [backupKeyText] = useState<string | null>(null);

  const send = useCallback((event: SealEvent) => {
    phase.current = sealReducer(phase.current, event);
    dispatch(event);
  }, []);

  const onCreatePress = useCallback(() => {
    if (deps === null || inFlight.current || phase.current.tag !== "write") return;
    inFlight.current = true;
    send({ type: "CREATE_PRESS" });
    void pressCreate(deps)
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
  }, [deps, send]);

  const onConfirmPress = useCallback(() => {
    const createdKey = created.current;
    if (deps === null || inFlight.current || phase.current.tag !== "created" || createdKey === null) {
      return;
    }
    inFlight.current = true;
    send({ type: "CONFIRM_PRESS" });

    const run = async (): Promise<void> => {
      try {
        const step = await pressConfirm(deps, createdKey);
        if (!step.ok) {
          send(step.event);
          return;
        }
        confirmed.current = step.confirmed;
        send({ type: "CONFIRMED" });
        const outcome = await sealWithPasskey(deps, {
          draft,
          confirmed: step.confirmed,
          onPrepared: () => send({ type: "PREPARED" }),
        });
        send(outcome.event);
      } catch {
        send({ type: "FAILED", kind: "server", passkeyCreated: true });
      } finally {
        // Terminal either way: the next attempt starts from a new passkey.
        created.current = null;
        confirmed.current = null;
        inFlight.current = false;
      }
    };
    void run();
  }, [deps, draft, send]);

  const onFallbackStart = useCallback(() => undefined, []);
  const onFallbackSealPress = useCallback(() => undefined, []);
  const onFallbackDecline = useCallback(() => undefined, []);

  const onRetry = useCallback(() => {
    if (inFlight.current) return;
    created.current = null;
    confirmed.current = null;
    backupKey.current = null;
    send({ type: "RETRY" });
  }, [send]);

  return {
    state,
    onCreatePress,
    onConfirmPress,
    onFallbackStart,
    onFallbackSealPress,
    onFallbackDecline,
    onRetry,
    backupKeyText,
  };
}
