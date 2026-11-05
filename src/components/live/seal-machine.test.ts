// Feature: 06-lock-and-unlock, Property 15: The Seal_Page never prompts after prepare and seals only once
// (design.md, Correctness Properties; R15.1, R15.5, R15.10).

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  INITIAL_SEAL_STATE,
  sealReducer,
  type SealEvent,
  type SealFailureKind,
  type SealState,
} from "./seal-machine";

const KINDS: readonly SealFailureKind[] = ["network", "server", "clock", "busy", "missing_then"];

// 64 lowercase hex characters, the shape of an envelope hash.
const hexHashArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(..."0123456789abcdef".split("")), { minLength: 64, maxLength: 64 })
  .map((chars) => chars.join(""));

// The source states each press or result event is accepted in, written from
// the state diagram, not from the reducer.
const ACCEPTED_FROM: Partial<Record<SealEvent["type"], readonly SealState["tag"][]>> = {
  CREATE_PRESS: ["write"],
  CREATED: ["creating"],
  CONFIRM_PRESS: ["created"],
  CONFIRMED: ["confirming"],
  PREPARED: ["preparing"],
  SEALED: ["sealing"],
  FALLBACK_START: ["cannot_lock"],
  FALLBACK_SEAL_PRESS: ["fallback_key"],
  FALLBACK_DECLINE: ["fallback_key"],
};

const eventArb: fc.Arbitrary<SealEvent> = fc.oneof(
  fc.constant<SealEvent>({ type: "CREATE_PRESS" }),
  fc.constant<SealEvent>({ type: "CREATED" }),
  fc.constant<SealEvent>({ type: "CONFIRM_PRESS" }),
  fc.constant<SealEvent>({ type: "CONFIRMED" }),
  fc.constant<SealEvent>({ type: "PREPARED" }),
  fc.record({
    type: fc.constant("SEALED" as const),
    letterId: fc.string({ maxLength: 12 }),
    sealedAt: fc.string({ maxLength: 12 }),
    opensAt: fc.string({ maxLength: 12 }),
    offsetMs: fc.integer({ min: -5_000, max: 5_000 }),
    factors: fc.constantFrom("passkey" as const, "backup" as const, "both" as const),
    envelopeHash: hexHashArb,
  }),
  fc.record({
    type: fc.constant("CANNOT_LOCK" as const),
    passkeyCreated: fc.boolean(),
  }),
  fc.record({
    type: fc.constant("FAILED" as const),
    kind: fc.constantFrom(...KINDS),
    metricId: fc.string({ maxLength: 12 }),
    passkeyCreated: fc.boolean(),
  }),
  fc.constant<SealEvent>({ type: "CANCELLED" }),
  fc.constant<SealEvent>({ type: "RETRY" }),
  fc.constant<SealEvent>({ type: "FALLBACK_START" }),
  fc.constant<SealEvent>({ type: "FALLBACK_SEAL_PRESS" }),
  fc.constant<SealEvent>({ type: "FALLBACK_DECLINE" }),
);

describe("Property 15: the Seal_Page never prompts after prepare and seals only once", () => {
  it("holds for any event sequence starting at write", () => {
    fc.assert(
      fc.property(fc.array(eventArb, { maxLength: 60 }), (events) => {
        let state: SealState = INITIAL_SEAL_STATE;
        let enteredPreparing = 0;
        let enteredSealing = 0;

        for (const event of events) {
          const prev = state;
          const next = sealReducer(prev, event);

          // Never back to creating or confirming from preparing or sealing.
          if (prev.tag === "preparing" || prev.tag === "sealing") {
            expect(["creating", "confirming"]).not.toContain(next.tag);
          }

          // sealed is reachable only from sealing.
          if (next.tag === "sealed") {
            expect(prev.tag).toBe("sealing");
          }

          // A press or result event outside its source state changes nothing.
          const accepted = ACCEPTED_FROM[event.type];
          if (accepted !== undefined && !accepted.includes(prev.tag)) {
            expect(next).toBe(prev);
          }

          if (next.tag === "preparing" && prev.tag !== "preparing") enteredPreparing += 1;
          if (next.tag === "sealing" && prev.tag !== "sealing") enteredSealing += 1;

          state = next;
        }

        // Each seal follows a prepare, so at most one seal per prepare.
        expect(enteredSealing).toBeLessThanOrEqual(enteredPreparing);
      }),
      { numRuns: 300 },
    );
  });
});

describe("sealReducer transitions", () => {
  it("walks the success path write to sealed", () => {
    let state: SealState = INITIAL_SEAL_STATE;
    state = sealReducer(state, { type: "CREATE_PRESS" });
    expect(state.tag).toBe("creating");
    state = sealReducer(state, { type: "CREATED" });
    expect(state.tag).toBe("created");
    state = sealReducer(state, { type: "CONFIRM_PRESS" });
    expect(state.tag).toBe("confirming");
    state = sealReducer(state, { type: "CONFIRMED" });
    expect(state.tag).toBe("preparing");
    state = sealReducer(state, { type: "PREPARED" });
    expect(state.tag).toBe("sealing");
    state = sealReducer(state, {
      type: "SEALED",
      letterId: "abc",
      sealedAt: "2026-11-02T10:00:00.000Z",
      opensAt: "2026-11-02T10:00:30.000Z",
      offsetMs: 0,
      factors: "passkey",
      envelopeHash: "a".repeat(64),
    });
    expect(state).toEqual({
      tag: "sealed",
      letterId: "abc",
      sealedAt: "2026-11-02T10:00:00.000Z",
      opensAt: "2026-11-02T10:00:30.000Z",
      offsetMs: 0,
      factors: "passkey",
      envelopeHash: "a".repeat(64),
    });
  });

  it("ignores a second press while a step is in flight", () => {
    const creating: SealState = { tag: "creating" };
    expect(sealReducer(creating, { type: "CREATE_PRESS" })).toBe(creating);
    const preparing: SealState = { tag: "preparing" };
    expect(sealReducer(preparing, { type: "CONFIRM_PRESS" })).toBe(preparing);
  });

  it("keeps the failure fields, and omits metricId when the event has none", () => {
    const sealing: SealState = { tag: "sealing" };
    expect(
      sealReducer(sealing, { type: "FAILED", kind: "network", passkeyCreated: true }),
    ).toEqual({ tag: "failed", kind: "network", passkeyCreated: true });
    expect(
      sealReducer(sealing, {
        type: "FAILED",
        kind: "missing_then",
        metricId: "us-diesel",
        passkeyCreated: false,
      }),
    ).toEqual({ tag: "failed", kind: "missing_then", metricId: "us-diesel", passkeyCreated: false });
  });

  it("maps CANNOT_LOCK to cannot_lock with passkeyCreated", () => {
    expect(
      sealReducer({ tag: "sealing" }, { type: "CANNOT_LOCK", passkeyCreated: true }),
    ).toEqual({ tag: "cannot_lock", passkeyCreated: true });
  });

  it("returns to write on RETRY from cancelled, failed and cannot_lock", () => {
    expect(sealReducer({ tag: "cancelled" }, { type: "RETRY" })).toEqual({ tag: "write" });
    expect(
      sealReducer({ tag: "failed", kind: "server", passkeyCreated: false }, { type: "RETRY" }),
    ).toEqual({ tag: "write" });
    expect(sealReducer({ tag: "cannot_lock", passkeyCreated: false }, { type: "RETRY" })).toEqual({
      tag: "write",
    });
  });

  it("moves cannot_lock to fallback_key on FALLBACK_START and keeps passkeyCreated", () => {
    expect(
      sealReducer({ tag: "cannot_lock", passkeyCreated: true }, { type: "FALLBACK_START" }),
    ).toEqual({ tag: "fallback_key", passkeyCreated: true });
    expect(
      sealReducer({ tag: "cannot_lock", passkeyCreated: false }, { type: "FALLBACK_START" }),
    ).toEqual({ tag: "fallback_key", passkeyCreated: false });
  });

  it("moves fallback_key to preparing on FALLBACK_SEAL_PRESS", () => {
    expect(
      sealReducer({ tag: "fallback_key", passkeyCreated: true }, { type: "FALLBACK_SEAL_PRESS" }),
    ).toEqual({ tag: "preparing" });
  });

  it("moves fallback_key back to cannot_lock on FALLBACK_DECLINE with the same passkeyCreated", () => {
    expect(
      sealReducer({ tag: "fallback_key", passkeyCreated: true }, { type: "FALLBACK_DECLINE" }),
    ).toEqual({ tag: "cannot_lock", passkeyCreated: true });
    expect(
      sealReducer({ tag: "fallback_key", passkeyCreated: false }, { type: "FALLBACK_DECLINE" }),
    ).toEqual({ tag: "cannot_lock", passkeyCreated: false });
  });

  it("ignores fallback events outside their source states", () => {
    expect(sealReducer(INITIAL_SEAL_STATE, { type: "FALLBACK_START" })).toBe(INITIAL_SEAL_STATE);
    expect(sealReducer(INITIAL_SEAL_STATE, { type: "FALLBACK_DECLINE" })).toBe(INITIAL_SEAL_STATE);
    const fallback: SealState = { tag: "fallback_key", passkeyCreated: false };
    expect(sealReducer(fallback, { type: "FALLBACK_START" })).toBe(fallback);
    expect(sealReducer(fallback, { type: "RETRY" })).toBe(fallback);
  });
});
