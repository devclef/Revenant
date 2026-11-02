// Pure reducer for the Seal_Page sealing flow (spec 06-lock-and-unlock,
// design.md "Seal_Page state machine"). No React, no I/O.
//
// Form data, secrets (credential, PRF output, Server_Secret, backup key) are
// not held here. Each press event is accepted only in its source state, so a
// second press while a step is in flight changes nothing (R15.10).

export type SealFailureKind = "network" | "server" | "clock" | "busy" | "missing_then";

export type SealState =
  | { tag: "write" }
  | { tag: "creating" }
  | { tag: "created" }
  | { tag: "confirming" }
  | { tag: "preparing" }
  | { tag: "sealing" }
  | { tag: "fallback_key"; passkeyCreated: boolean }
  | {
      tag: "sealed";
      letterId: string;
      sealedAt: string;
      opensAt: string;
      offsetMs: number;
      factors: "passkey" | "backup" | "both";
    }
  | { tag: "cannot_lock"; passkeyCreated: boolean }
  | { tag: "cancelled" }
  | { tag: "failed"; kind: SealFailureKind; metricId?: string; passkeyCreated: boolean };

export type SealEvent =
  | { type: "CREATE_PRESS" }
  | { type: "CREATED" }
  | { type: "CONFIRM_PRESS" }
  | { type: "CONFIRMED" }
  | { type: "PREPARED" }
  | {
      type: "SEALED";
      letterId: string;
      sealedAt: string;
      opensAt: string;
      offsetMs: number;
      factors: "passkey" | "backup" | "both";
    }
  | { type: "CANNOT_LOCK"; passkeyCreated: boolean }
  | { type: "FAILED"; kind: SealFailureKind; metricId?: string; passkeyCreated: boolean }
  | { type: "CANCELLED" }
  | { type: "RETRY" }
  // Backup-key fallback, entered from cannot_lock.
  | { type: "FALLBACK_START" }
  | { type: "FALLBACK_SEAL_PRESS" }
  | { type: "FALLBACK_DECLINE" };

export const INITIAL_SEAL_STATE: SealState = { tag: "write" };

function failedState(event: Extract<SealEvent, { type: "FAILED" }>): SealState {
  return {
    tag: "failed",
    kind: event.kind,
    passkeyCreated: event.passkeyCreated,
    ...(event.metricId !== undefined ? { metricId: event.metricId } : {}),
  };
}

export function sealReducer(state: SealState, event: SealEvent): SealState {
  switch (state.tag) {
    case "write":
      return event.type === "CREATE_PRESS" ? { tag: "creating" } : state;

    case "creating":
      switch (event.type) {
        case "CREATED":
          return { tag: "created" };
        case "CANCELLED":
          return { tag: "cancelled" };
        case "CANNOT_LOCK":
          return { tag: "cannot_lock", passkeyCreated: event.passkeyCreated };
        case "FAILED":
          return failedState(event);
        default:
          return state;
      }

    case "created":
      return event.type === "CONFIRM_PRESS" ? { tag: "confirming" } : state;

    case "confirming":
      switch (event.type) {
        case "CONFIRMED":
          return { tag: "preparing" };
        case "CANCELLED":
          return { tag: "cancelled" };
        case "CANNOT_LOCK":
          return { tag: "cannot_lock", passkeyCreated: event.passkeyCreated };
        case "FAILED":
          return failedState(event);
        default:
          return state;
      }

    case "preparing":
      switch (event.type) {
        case "PREPARED":
          return { tag: "sealing" };
        case "FAILED":
          return failedState(event);
        default:
          return state;
      }

    case "sealing":
      switch (event.type) {
        case "SEALED":
          return {
            tag: "sealed",
            letterId: event.letterId,
            sealedAt: event.sealedAt,
            opensAt: event.opensAt,
            offsetMs: event.offsetMs,
            factors: event.factors,
          };
        case "CANNOT_LOCK":
          return { tag: "cannot_lock", passkeyCreated: event.passkeyCreated };
        case "FAILED":
          return failedState(event);
        default:
          return state;
      }

    case "cannot_lock":
      switch (event.type) {
        case "RETRY":
          return { tag: "write" };
        case "FALLBACK_START":
          return { tag: "fallback_key", passkeyCreated: state.passkeyCreated };
        default:
          return state;
      }

    case "cancelled":
    case "failed":
      return event.type === "RETRY" ? { tag: "write" } : state;

    case "fallback_key":
      switch (event.type) {
        case "FALLBACK_SEAL_PRESS":
          return { tag: "preparing" };
        case "FALLBACK_DECLINE":
          return { tag: "cannot_lock", passkeyCreated: state.passkeyCreated };
        default:
          return state;
      }

    case "sealed":
      return state;
  }
}
