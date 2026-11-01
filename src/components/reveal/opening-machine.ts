/**
 * Opening_Flow state machine (design.md "Opening_Flow state machine").
 *
 * A pure reducer: `reduce(state, event)` returns the next `FlowState` and does
 * nothing else. It performs no I/O, no crypto, no storage, no logging and no
 * timers. The effect runner (`useOpeningFlow.ts`) owns every side effect and
 * sends the results back as events; the views render from the state alone. This
 * keeps the gating rules (nothing shown before the record is stored) testable
 * without a browser.
 *
 * The reducer enforces, per design.md:
 * - One attempt at a time (R7.1): `START` is accepted only in the initial
 *   state, in `unreachable` (retry) and in `sealed` (retry); every other state
 *   ignores it.
 * - Seal message first (R7.5): `verified` shows only the verification statement
 *   and a "Begin" button; recall questions render only in `recall`.
 * - Recall only after `verified`: `BEGIN` moves `verified` to `recall`.
 * - Single submission (R8.9): in `submitting`, `SUBMIT` and `RETRY_POST` are
 *   ignored.
 * - Retry resends the same record (R8.7): `submit_failed` keeps the sealed
 *   ciphertext and nonce, and `RETRY_POST` posts those exact bytes again.
 * - Reveal gate (R8.1, R9.1): only `POST_OK` from `submitting` enters `reveal`,
 *   always at stage 1. `ADVANCE` adds one stage up to 3; `SHOW_ALL` sets 3.
 * - Error states hold no payload (R7.6, R7.7, R7.9): `verification_failed`,
 *   `open_failed`, `not_placed` and `unreachable` carry no `Opened`.
 *
 * This module imports no runtime values. It imports only the types
 * `RecallRecordV1` and `Draft` from `@/lib/recall` and `PayloadV1` from
 * `@/lib/seal-format`. It never imports `@/lib/crypto` or
 * `@/lib/recall/generate`.
 */

import type { RecallRecordV1, Draft } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * A recall question exactly as it was sealed, read from the frozen payload
 * schema so this module and the seal format can never drift.
 */
export type RecallQuestion = PayloadV1["recall_questions"][number];

/**
 * An opened letter held in memory only (R7.10). The `openingKey` is a
 * non-extractable `CryptoKey` and never leaves the browser.
 */
export type Opened = {
  letterId: string;
  /** From the parsed envelope header; both are millisecond-`Z` strings. */
  header: { sealedAt: string; opensAt: string };
  payload: PayloadV1;
  /** Non-extractable, memory only; used to encrypt the recall record. */
  openingKey: CryptoKey;
};

/** The sealed recall record as bytes ready to post (base64url strings). */
export type SealedRecord = { ciphertext: string; nonce: string };

/** The kinds of failure `openLetter` can report (design.md Error Handling). */
export type OpenFailedKind =
  | "wrong_key"
  | "tampered"
  | "unsupported_format"
  | "invalid_payload"
  | "invalid_input";

/**
 * The Opening_Flow state. Each tag is a distinct screen; the views pick one by
 * `state.tag`. Error states carry no `Opened`, so their views cannot render any
 * payload field.
 */
export type FlowState =
  | { tag: "loading" }
  | { tag: "sealed"; opensAt: string }
  | { tag: "openable"; envelope: unknown; envelopeHash: string }
  | { tag: "verifying" }
  | { tag: "verified"; opened: Opened }
  | {
      tag: "recall";
      opened: Opened;
      drafts: Record<string, Draft>;
      invalid: string[];
    }
  | {
      tag: "submitting";
      opened: Opened;
      drafts: Record<string, Draft>;
      record: RecallRecordV1;
      sealed: SealedRecord;
    }
  | {
      tag: "submit_failed";
      opened: Opened;
      drafts: Record<string, Draft>;
      record: RecallRecordV1;
      sealed: SealedRecord;
    }
  | { tag: "reveal"; opened: Opened; record: RecallRecordV1; stage: 1 | 2 | 3 }
  | { tag: "not_placed" }
  | { tag: "unreachable" }
  | { tag: "verification_failed" }
  | { tag: "open_failed"; kind: OpenFailedKind };

/** The initial state: the flow starts fetching as soon as it mounts. */
export const INITIAL_STATE: FlowState = { tag: "loading" };

/**
 * The events the effect runner and the views send to the reducer.
 *
 * - `START`: (re)start the attempt. Accepted only in the initial, `unreachable`
 *   and `sealed` states.
 * - `LETTER_SEALED` / `LETTER_OPENABLE` / `LETTER_NOT_PLACED` /
 *   `UNREACHABLE`: the outcome of `GET /api/letters/{id}`.
 * - `SECRET_FORBIDDEN` / `SECRET_OK`: the outcome of
 *   `GET /api/letters/{id}/secret`.
 * - `OPENED` / `VERIFICATION_FAILED` / `OPEN_FAILED`: the outcome of
 *   `openLetter`.
 * - `BEGIN`: move from the verification statement to the recall step.
 * - `EDIT_DRAFT` / `TOGGLE_NO_ANSWER`: the judge editing a recall answer.
 * - `SUBMIT_INVALID`: a submit attempt whose answers did not all validate; the
 *   listed question IDs are invalid and the drafts stay as typed.
 * - `RECORD_SEALED`: the effect runner has validated and encrypted the record;
 *   move to `submitting` and post it.
 * - `POST_OK`: the opening was stored; enter the reveal at stage 1.
 * - `POST_FAILED`: the post failed; keep the sealed record for retry.
 * - `RETRY_POST`: post the same sealed bytes again.
 * - `ADVANCE` / `SHOW_ALL`: reveal pacing, driven only by the judge.
 */
export type FlowEvent =
  | { type: "START" }
  | { type: "LETTER_SEALED"; opensAt: string }
  | { type: "LETTER_OPENABLE"; envelope: unknown; envelopeHash: string }
  | { type: "LETTER_NOT_PLACED" }
  | { type: "UNREACHABLE" }
  | { type: "SECRET_FORBIDDEN"; opensAt: string }
  | { type: "SECRET_OK" }
  | { type: "OPENED"; opened: Opened }
  | { type: "VERIFICATION_FAILED" }
  | { type: "OPEN_FAILED"; kind: OpenFailedKind }
  | { type: "BEGIN" }
  | { type: "EDIT_DRAFT"; id: string; text: string }
  | { type: "TOGGLE_NO_ANSWER"; id: string; noAnswer: boolean }
  | { type: "SUBMIT_INVALID"; invalid: string[] }
  | {
      type: "RECORD_SEALED";
      record: RecallRecordV1;
      sealed: SealedRecord;
    }
  | { type: "POST_OK" }
  | { type: "POST_FAILED" }
  | { type: "RETRY_POST" }
  | { type: "ADVANCE" }
  | { type: "SHOW_ALL" };

/** A fresh draft for a question that has not been touched yet. */
function emptyDraft(): Draft {
  return { text: "", noAnswer: false };
}

/**
 * Apply one draft edit to a recall state, returning a new drafts map. The edit
 * leaves the stored draft for `id` with the new text (or toggle) and keeps
 * every other draft as it was. Editing clears that question from `invalid`, so
 * a corrected answer no longer shows its error.
 */
function withDraft(
  state: Extract<FlowState, { tag: "recall" }>,
  id: string,
  change: Partial<Draft>,
): FlowState {
  const current = state.drafts[id] ?? emptyDraft();
  const drafts = { ...state.drafts, [id]: { ...current, ...change } };
  const invalid = state.invalid.filter((x) => x !== id);
  return { tag: "recall", opened: state.opened, drafts, invalid };
}

/**
 * The pure Opening_Flow reducer. Returns the next state for a `(state, event)`
 * pair, or the state unchanged when the event does not apply in that state.
 * Performs no side effects.
 */
export function reduce(state: FlowState, event: FlowEvent): FlowState {
  switch (state.tag) {
    case "loading": {
      switch (event.type) {
        case "LETTER_SEALED":
          return { tag: "sealed", opensAt: event.opensAt };
        case "LETTER_OPENABLE":
          return {
            tag: "openable",
            envelope: event.envelope,
            envelopeHash: event.envelopeHash,
          };
        case "LETTER_NOT_PLACED":
          return { tag: "not_placed" };
        case "UNREACHABLE":
          return { tag: "unreachable" };
        default:
          return state;
      }
    }

    case "sealed": {
      // Retry after the countdown reaches zero (R7.1).
      if (event.type === "START") {
        return { tag: "loading" };
      }
      return state;
    }

    case "openable": {
      switch (event.type) {
        case "SECRET_FORBIDDEN":
          return { tag: "sealed", opensAt: event.opensAt };
        case "SECRET_OK":
          return { tag: "verifying" };
        case "UNREACHABLE":
          return { tag: "unreachable" };
        default:
          return state;
      }
    }

    case "verifying": {
      switch (event.type) {
        case "OPENED":
          return { tag: "verified", opened: event.opened };
        case "VERIFICATION_FAILED":
          return { tag: "verification_failed" };
        case "OPEN_FAILED":
          return { tag: "open_failed", kind: event.kind };
        default:
          return state;
      }
    }

    case "verified": {
      // Recall only after verified (R7.5): "Begin" opens the recall step with a
      // fresh empty draft per question.
      if (event.type === "BEGIN") {
        const drafts: Record<string, Draft> = {};
        for (const question of state.opened.payload.recall_questions) {
          drafts[question.id] = emptyDraft();
        }
        return { tag: "recall", opened: state.opened, drafts, invalid: [] };
      }
      return state;
    }

    case "recall": {
      switch (event.type) {
        case "EDIT_DRAFT":
          return withDraft(state, event.id, { text: event.text });
        case "TOGGLE_NO_ANSWER":
          return withDraft(state, event.id, { noAnswer: event.noAnswer });
        case "SUBMIT_INVALID":
          return {
            tag: "recall",
            opened: state.opened,
            drafts: state.drafts,
            invalid: event.invalid,
          };
        case "RECORD_SEALED":
          // Every answer validated and the record encrypted: move to
          // submitting and post it (R8.9 then gates re-submits).
          return {
            tag: "submitting",
            opened: state.opened,
            drafts: state.drafts,
            record: event.record,
            sealed: event.sealed,
          };
        default:
          return state;
      }
    }

    case "submitting": {
      // Single submission (R8.9): SUBMIT and RETRY_POST are ignored here.
      switch (event.type) {
        case "POST_OK":
          // Reveal gate (R8.1, R9.1): only this transition enters reveal, and
          // it always enters at stage 1.
          return {
            tag: "reveal",
            opened: state.opened,
            record: state.record,
            stage: 1,
          };
        case "POST_FAILED":
          return {
            tag: "submit_failed",
            opened: state.opened,
            drafts: state.drafts,
            record: state.record,
            sealed: state.sealed,
          };
        default:
          return state;
      }
    }

    case "submit_failed": {
      // Retry resends the same record (R8.7): the exact ciphertext and nonce
      // held here are posted again.
      if (event.type === "RETRY_POST") {
        return {
          tag: "submitting",
          opened: state.opened,
          drafts: state.drafts,
          record: state.record,
          sealed: state.sealed,
        };
      }
      return state;
    }

    case "reveal": {
      switch (event.type) {
        case "ADVANCE":
          return {
            tag: "reveal",
            opened: state.opened,
            record: state.record,
            stage: state.stage < 3 ? ((state.stage + 1) as 2 | 3) : 3,
          };
        case "SHOW_ALL":
          return {
            tag: "reveal",
            opened: state.opened,
            record: state.record,
            stage: 3,
          };
        default:
          return state;
      }
    }

    case "unreachable": {
      // Retry (R7.1): START is accepted here and restarts the fetch.
      if (event.type === "START") {
        return { tag: "loading" };
      }
      return state;
    }

    case "not_placed":
    case "verification_failed":
    case "open_failed":
      // Terminal error states. They carry no payload and ignore every event.
      return state;

    default:
      return state;
  }
}
