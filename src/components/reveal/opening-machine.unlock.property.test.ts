// Feature: 06-lock-and-unlock, Property 17: The Opening_Flow additions keep the gates
//
// For any sequence of Opening_Flow events (old and new), `reveal` is reached
// only from `submitting` by `POST_OK`; `verified` only from `verifying` or
// `unlocking` by `OPENED`; `awaiting_key`, `unlocking` and every error state
// hold no opened letter; `KEY_REJECTED` from `unlocking` always returns to
// `awaiting_key`; and the new events change nothing outside their own
// transitions.
//
// The old-transition half of the property is pinned by the unchanged
// opening-machine.test.ts and opening-machine.property.test.ts suites.
//
// Validates R17.3, R17.8, R17.14.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { Opened, FlowState, FlowEvent, KeyNotice, UnlockInfo } from "./opening-machine";
import { INITIAL_STATE, reduce } from "./opening-machine";

// --- fixtures ----------------------------------------------------------------

// The reducer never reads inside `opened`, so a stub is enough.
const OPENED_STUB: Opened = {
  letterId: "letter-1",
  header: {
    sealedAt: "2030-01-01T00:00:00.000Z",
    opensAt: "2030-02-01T00:00:00.000Z",
  },
  payload: { recall_questions: [] } as never,
  openingKey: {} as never,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

const RECORD = { version: 1, answers: [] } as never;
const SEALED = { ciphertext: "c", nonce: "n" } as never;
const DRAFTS = {} as never;

const UNLOCK_INFO: UnlockInfo = {
  passkey: { rpId: "revenant.devclef.se" },
  backup: true,
};

const KEY_NOTICES: KeyNotice[] = [
  "cancelled",
  "no_prf",
  "failed",
  "wrong_domain",
  "mistyped_key",
  "wrong_passkey",
  "wrong_backup",
];

// Tags that hold no opened letter (design: awaiting_key, unlocking and every
// error state).
const NO_OPENED_TAGS = new Set<FlowState["tag"]>([
  "awaiting_key",
  "unlocking",
  "not_placed",
  "unreachable",
  "verification_failed",
  "open_failed",
]);

// --- arbitraries -------------------------------------------------------------

const unlockArb: fc.Arbitrary<UnlockInfo> = fc.record({
  passkey: fc.option(fc.record({ rpId: fc.constant("revenant.devclef.se") }), {
    nil: null,
  }),
  backup: fc.boolean(),
});

const keyNoticeArb: fc.Arbitrary<KeyNotice> = fc.constantFrom(...KEY_NOTICES);

const OPEN_FAILED_KINDS = [
  "wrong_key",
  "tampered",
  "unsupported_format",
  "invalid_payload",
  "invalid_input",
] as const;

// Every FlowEvent type, the four new ones included.
const eventArb: fc.Arbitrary<FlowEvent> = fc.oneof(
  fc.constant<FlowEvent>({ type: "START" }),
  fc.constant<FlowEvent>({
    type: "LETTER_SEALED",
    opensAt: "2030-01-01T00:00:00.000Z",
  }),
  fc.constant<FlowEvent>({
    type: "LETTER_OPENABLE",
    envelope: { e: 1 },
    envelopeHash: "hash",
  }),
  fc.constant<FlowEvent>({ type: "LETTER_NOT_PLACED" }),
  fc.constant<FlowEvent>({ type: "UNREACHABLE" }),
  fc.constant<FlowEvent>({
    type: "SECRET_FORBIDDEN",
    opensAt: "2030-01-01T00:00:00.000Z",
  }),
  fc.constant<FlowEvent>({ type: "SECRET_OK" }),
  fc.constant<FlowEvent>({ type: "OPENED", opened: OPENED_STUB }),
  fc.constant<FlowEvent>({ type: "VERIFICATION_FAILED" }),
  ...OPEN_FAILED_KINDS.map((kind) =>
    fc.constant<FlowEvent>({ type: "OPEN_FAILED", kind }),
  ),
  fc.constant<FlowEvent>({ type: "BEGIN" }),
  fc.constant<FlowEvent>({ type: "EDIT_DRAFT", id: "q1", text: "3.50" }),
  fc.constant<FlowEvent>({ type: "TOGGLE_NO_ANSWER", id: "q1", noAnswer: true }),
  fc.constant<FlowEvent>({ type: "SUBMIT_INVALID", invalid: ["q1"] }),
  fc.constant<FlowEvent>({
    type: "RECORD_SEALED",
    record: RECORD,
    sealed: SEALED,
  }),
  fc.constant<FlowEvent>({ type: "POST_OK" }),
  fc.constant<FlowEvent>({ type: "POST_FAILED" }),
  fc.constant<FlowEvent>({ type: "RETRY_POST" }),
  fc.constant<FlowEvent>({ type: "ADVANCE" }),
  fc.constant<FlowEvent>({ type: "SHOW_ALL" }),
  unlockArb.map((unlock) => ({ type: "NEEDS_KEY", unlock }) as FlowEvent),
  keyNoticeArb.map((notice) => ({ type: "KEY_NOTICE", notice }) as FlowEvent),
  fc.constant<FlowEvent>({ type: "UNLOCK" }),
  fc.constantFrom<"passkey" | "backup">("passkey", "backup").map(
    (factor) => ({ type: "KEY_REJECTED", factor }) as FlowEvent,
  ),
);

const sequenceArb = fc.array(eventArb, { minLength: 1, maxLength: 40 });

// Starting states cover every tag, so transitions are exercised from each one
// and not only from states a random walk happens to reach.
const startStateArb: fc.Arbitrary<FlowState> = fc.oneof(
  fc.constant<FlowState>(INITIAL_STATE),
  fc.constant<FlowState>({ tag: "sealed", opensAt: "2030-01-01T00:00:00.000Z" }),
  fc.constant<FlowState>({ tag: "openable", envelope: {}, envelopeHash: "h" }),
  fc.constant<FlowState>({
    tag: "awaiting_key",
    envelope: {},
    envelopeHash: "h",
    unlock: UNLOCK_INFO,
    notice: null,
  }),
  fc.constant<FlowState>({
    tag: "unlocking",
    envelope: {},
    envelopeHash: "h",
    unlock: UNLOCK_INFO,
  }),
  fc.constant<FlowState>({ tag: "verifying" }),
  fc.constant<FlowState>({ tag: "verified", opened: OPENED_STUB }),
  fc.constant<FlowState>({
    tag: "recall",
    opened: OPENED_STUB,
    drafts: DRAFTS,
    invalid: [],
  }),
  fc.constant<FlowState>({
    tag: "submitting",
    opened: OPENED_STUB,
    drafts: DRAFTS,
    record: RECORD,
    sealed: SEALED,
  }),
  fc.constant<FlowState>({
    tag: "reveal",
    opened: OPENED_STUB,
    record: RECORD,
    stage: 1,
  }),
  fc.constant<FlowState>({ tag: "not_placed" }),
  fc.constant<FlowState>({ tag: "unreachable" }),
  fc.constant<FlowState>({ tag: "verification_failed" }),
  fc.constant<FlowState>({ tag: "open_failed", kind: "wrong_key" }),
);

// Run a sequence from a start state and return every (prev, event, next) step.
function walk(
  start: FlowState,
  events: FlowEvent[],
): Array<{ prev: FlowState; event: FlowEvent; next: FlowState }> {
  const steps: Array<{ prev: FlowState; event: FlowEvent; next: FlowState }> = [];
  let state = start;
  for (const event of events) {
    const next = reduce(state, event);
    steps.push({ prev: state, event, next });
    state = next;
  }
  return steps;
}

// --- the property ------------------------------------------------------------

describe("Property 17: the Opening_Flow additions keep the gates (R17.3, R17.8, R17.14)", () => {
  it("reveal is reached only from submitting by POST_OK, after every step of every sequence", () => {
    fc.assert(
      fc.property(startStateArb, sequenceArb, (start, events) => {
        for (const { prev, event, next } of walk(start, events)) {
          if (next.tag === "reveal" && prev.tag !== "reveal") {
            expect(prev.tag).toBe("submitting");
            expect(event.type).toBe("POST_OK");
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("verified is reached only from verifying or unlocking by OPENED", () => {
    fc.assert(
      fc.property(startStateArb, sequenceArb, (start, events) => {
        for (const { prev, event, next } of walk(start, events)) {
          if (next.tag === "verified" && prev.tag !== "verified") {
            expect(["verifying", "unlocking"]).toContain(prev.tag);
            expect(event.type).toBe("OPENED");
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("awaiting_key, unlocking and every error state never hold an opened letter", () => {
    fc.assert(
      fc.property(startStateArb, sequenceArb, (start, events) => {
        for (const { next } of walk(start, events)) {
          if (NO_OPENED_TAGS.has(next.tag)) {
            expect(next).not.toHaveProperty("opened");
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("KEY_REJECTED from unlocking always returns to awaiting_key with the matching notice", () => {
    fc.assert(
      fc.property(
        startStateArb,
        sequenceArb,
        fc.constantFrom<"passkey" | "backup">("passkey", "backup"),
        (start, events, factor) => {
          for (const { prev } of walk(start, events)) {
            // Check this at every point the sequence reaches unlocking.
            if (prev.tag !== "unlocking") continue;
            const rejected = reduce(prev, { type: "KEY_REJECTED", factor });
            expect(rejected.tag).toBe("awaiting_key");
            if (rejected.tag === "awaiting_key") {
              expect(rejected.notice).toBe(
                factor === "passkey" ? "wrong_passkey" : "wrong_backup",
              );
              expect(rejected.envelope).toBe(prev.envelope);
              expect(rejected.envelopeHash).toBe(prev.envelopeHash);
              expect(rejected.unlock).toEqual(prev.unlock);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("awaiting_key and unlocking are entered only through the added transitions", () => {
    fc.assert(
      fc.property(startStateArb, sequenceArb, (start, events) => {
        for (const { prev, event, next } of walk(start, events)) {
          if (next.tag === "awaiting_key" && prev.tag !== "awaiting_key") {
            // Only NEEDS_KEY from openable, or KEY_REJECTED from unlocking.
            const fromOpenable =
              prev.tag === "openable" && event.type === "NEEDS_KEY";
            const fromUnlocking =
              prev.tag === "unlocking" && event.type === "KEY_REJECTED";
            expect(fromOpenable || fromUnlocking).toBe(true);
          }
          if (next.tag === "unlocking" && prev.tag !== "unlocking") {
            expect(prev.tag).toBe("awaiting_key");
            expect(event.type).toBe("UNLOCK");
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("the new events change nothing outside their own transitions", () => {
    const newEventArb = fc.oneof(
      unlockArb.map((unlock) => ({ type: "NEEDS_KEY", unlock }) as FlowEvent),
      keyNoticeArb.map((notice) => ({ type: "KEY_NOTICE", notice }) as FlowEvent),
      fc.constant<FlowEvent>({ type: "UNLOCK" }),
      fc.constantFrom<"passkey" | "backup">("passkey", "backup").map(
        (factor) => ({ type: "KEY_REJECTED", factor }) as FlowEvent,
      ),
    );
    fc.assert(
      fc.property(startStateArb, newEventArb, (state, event) => {
        const isAdded =
          (state.tag === "openable" && event.type === "NEEDS_KEY") ||
          (state.tag === "awaiting_key" &&
            (event.type === "KEY_NOTICE" || event.type === "UNLOCK")) ||
          (state.tag === "unlocking" && event.type === "KEY_REJECTED");
        if (!isAdded) {
          expect(reduce(state, event)).toBe(state);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("the added transitions carry the design table's targets", () => {
    const openable: FlowState = { tag: "openable", envelope: {}, envelopeHash: "h" };
    expect(reduce(openable, { type: "NEEDS_KEY", unlock: UNLOCK_INFO })).toEqual({
      tag: "awaiting_key",
      envelope: {},
      envelopeHash: "h",
      unlock: UNLOCK_INFO,
      notice: null,
    });
    expect(reduce(openable, { type: "OPEN_FAILED", kind: "invalid_payload" })).toEqual({
      tag: "open_failed",
      kind: "invalid_payload",
    });

    const awaiting: FlowState = {
      tag: "awaiting_key",
      envelope: {},
      envelopeHash: "h",
      unlock: UNLOCK_INFO,
      notice: null,
    };
    const withNotice = reduce(awaiting, { type: "KEY_NOTICE", notice: "no_prf" });
    expect(withNotice).toMatchObject({ tag: "awaiting_key", notice: "no_prf" });
    expect(reduce(awaiting, { type: "UNLOCK" })).toEqual({
      tag: "unlocking",
      envelope: {},
      envelopeHash: "h",
      unlock: UNLOCK_INFO,
    });

    const unlocking: FlowState = {
      tag: "unlocking",
      envelope: {},
      envelopeHash: "h",
      unlock: UNLOCK_INFO,
    };
    expect(reduce(unlocking, { type: "OPENED", opened: OPENED_STUB })).toEqual({
      tag: "verified",
      opened: OPENED_STUB,
    });
    expect(reduce(unlocking, { type: "VERIFICATION_FAILED" })).toEqual({
      tag: "verification_failed",
    });
    expect(reduce(unlocking, { type: "OPEN_FAILED", kind: "tampered" })).toEqual({
      tag: "open_failed",
      kind: "tampered",
    });
    expect(reduce(unlocking, { type: "KEY_REJECTED", factor: "backup" })).toEqual({
      tag: "awaiting_key",
      envelope: {},
      envelopeHash: "h",
      unlock: UNLOCK_INFO,
      notice: "wrong_backup",
    });
  });
});
