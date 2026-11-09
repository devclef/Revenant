/**
 * Unit tests for the Opening_Flow reducer (opening-machine.ts).
 *
 * These are pure-function tests: no DOM, no fetch, no crypto, no timers. They
 * drive `reduce(state, event)` through every transition and every gating rule
 * the reducer promises, and assert that disallowed events leave the state
 * unchanged (the reducer returns the same reference). Each gate maps to a
 * design.md rule cited in the reducer's own comments.
 */

import { describe, it, expect } from "vitest";
import type { RecallRecordV2 } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";
import { PAYLOAD_TEXT_3, PAYLOAD_TEXT_4 } from "@/lib/recall/fixtures.test-data";
import {
  INITIAL_STATE,
  reduce,
  type FlowState,
  type FlowEvent,
  type Opened,
  type SealedRecord,
} from "./opening-machine";

// --- Fixtures ----------------------------------------------------------------

// Two sealed recall questions. Enough to see a per-question draft map built.
const QUESTIONS: PayloadV1["recall_questions"] = [
  { id: "q1", answer_type: "number", text: "Gas then?", metric_id: "m1" },
  { id: "q2", answer_type: "number", text: "Milk then?", metric_id: "m2" },
];

const PAYLOAD = {
  recall_questions: QUESTIONS,
} as unknown as PayloadV1;

// The reducer never calls any method on the opening key, so a stub cast through
// `unknown` is enough and keeps the test in the node environment with no
// WebCrypto dependency.
const OPENING_KEY = {} as unknown as CryptoKey;

const OPENED: Opened = {
  letterId: "abc123",
  header: {
    sealedAt: "2024-05-01T00:00:00.000Z",
    opensAt: "2024-06-01T00:00:00.000Z",
  },
  payload: PAYLOAD,
  openingKey: OPENING_KEY,
  // The verified envelope hash the effect runner sets on OPENED (R14.5). The
  // reducer threads it through unchanged, so the fixture only needs to carry it.
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

const RECORD: RecallRecordV2 = {
  version: 2,
  answers: [
    { question_id: "q1", kind: "number", value: "3.41" },
    { question_id: "q2", kind: "no_answer" },
  ],
};

const SEALED: SealedRecord = {
  ciphertext: "Y2lwaGVydGV4dA",
  nonce: "bm9uY2U",
};

// --- Helpers -----------------------------------------------------------------

/** Drive the reducer from the initial state through an event sequence. */
function run(...events: FlowEvent[]): FlowState {
  return events.reduce((state, event) => reduce(state, event), INITIAL_STATE);
}

/** A recall state with the two questions' drafts empty. */
function recallState(): FlowState {
  return run(
    { type: "LETTER_OPENABLE", envelope: {}, envelopeHash: "h" },
    { type: "SECRET_OK" },
    { type: "OPENED", opened: OPENED },
  );
}

/** A submitting state (recall -> RECORD_SEALED). */
function submittingState(): FlowState {
  return reduce(recallState(), {
    type: "RECORD_SEALED",
    record: RECORD,
    sealed: SEALED,
  });
}

// --- loading -----------------------------------------------------------------

describe("loading", () => {
  it("is the initial state", () => {
    expect(INITIAL_STATE).toEqual({ tag: "loading" });
  });

  it("LETTER_SEALED -> sealed carrying opensAt", () => {
    const next = reduce(INITIAL_STATE, {
      type: "LETTER_SEALED",
      opensAt: "2030-01-01T00:00:00.000Z",
    });
    expect(next).toEqual({ tag: "sealed", opensAt: "2030-01-01T00:00:00.000Z" });
  });

  it("LETTER_OPENABLE -> openable carrying envelope and hash", () => {
    const env = { a: 1 };
    const next = reduce(INITIAL_STATE, {
      type: "LETTER_OPENABLE",
      envelope: env,
      envelopeHash: "deadbeef",
    });
    expect(next).toEqual({
      tag: "openable",
      envelope: env,
      envelopeHash: "deadbeef",
    });
  });

  it("LETTER_NOT_PLACED -> not_placed", () => {
    expect(reduce(INITIAL_STATE, { type: "LETTER_NOT_PLACED" })).toEqual({
      tag: "not_placed",
    });
  });

  it("UNREACHABLE -> unreachable", () => {
    expect(reduce(INITIAL_STATE, { type: "UNREACHABLE" })).toEqual({
      tag: "unreachable",
    });
  });

  it("ignores unrelated events", () => {
    expect(reduce(INITIAL_STATE, { type: "START" })).toBe(INITIAL_STATE);
    expect(reduce(INITIAL_STATE, { type: "POST_OK" })).toBe(INITIAL_STATE);
    expect(reduce(INITIAL_STATE, { type: "ADVANCE" })).toBe(INITIAL_STATE);
  });
});

// --- sealed (retry via START) ------------------------------------------------

describe("sealed", () => {
  const sealed: FlowState = { tag: "sealed", opensAt: "2030-01-01T00:00:00.000Z" };

  it("START -> loading (retry after the countdown, R7.1)", () => {
    expect(reduce(sealed, { type: "START" })).toEqual({ tag: "loading" });
  });

  it("ignores every other event", () => {
    expect(reduce(sealed, { type: "SECRET_OK" })).toBe(sealed);
    expect(reduce(sealed, { type: "POST_OK" })).toBe(sealed);
  });
});

// --- openable ----------------------------------------------------------------

describe("openable", () => {
  const openable: FlowState = {
    tag: "openable",
    envelope: { x: 1 },
    envelopeHash: "h",
  };

  it("SECRET_FORBIDDEN -> sealed carrying opensAt", () => {
    const next = reduce(openable, {
      type: "SECRET_FORBIDDEN",
      opensAt: "2031-02-02T00:00:00.000Z",
    });
    expect(next).toEqual({ tag: "sealed", opensAt: "2031-02-02T00:00:00.000Z" });
  });

  it("SECRET_OK -> verifying", () => {
    expect(reduce(openable, { type: "SECRET_OK" })).toEqual({ tag: "verifying" });
  });

  it("UNREACHABLE -> unreachable", () => {
    expect(reduce(openable, { type: "UNREACHABLE" })).toEqual({
      tag: "unreachable",
    });
  });

  it("ignores START and reveal events", () => {
    expect(reduce(openable, { type: "START" })).toBe(openable);
    expect(reduce(openable, { type: "POST_OK" })).toBe(openable);
  });
});

// --- verifying ---------------------------------------------------------------

describe("verifying", () => {
  const verifying: FlowState = { tag: "verifying" };

  it("OPENED -> recall with one empty draft per sealed question (spec 10 C1.1)", () => {
    const next = reduce(verifying, { type: "OPENED", opened: OPENED });
    expect(next.tag).toBe("recall");
    if (next.tag !== "recall") throw new Error("unreachable");
    expect(next.opened).toBe(OPENED);
    expect(next.invalid).toEqual([]);
    expect(next.drafts).toEqual({
      q1: { text: "", noAnswer: false },
      q2: { text: "", noAnswer: false },
    });
  });

  it("OPENED with samples prefills those drafts and leaves the rest empty (spec 10 C5.4)", () => {
    const next = reduce(verifying, {
      type: "OPENED",
      opened: OPENED,
      samples: { q1: "3.59" },
    });
    if (next.tag !== "recall") throw new Error("unreachable");
    expect(next.drafts).toEqual({
      q1: { text: "3.59", noAnswer: false },
      q2: { text: "", noAnswer: false },
    });
  });

  it("VERIFICATION_FAILED -> verification_failed with no Opened", () => {
    const next = reduce(verifying, { type: "VERIFICATION_FAILED" });
    expect(next).toEqual({ tag: "verification_failed" });
    expect("opened" in next).toBe(false);
  });

  it("OPEN_FAILED -> open_failed carrying only the kind", () => {
    const next = reduce(verifying, { type: "OPEN_FAILED", kind: "wrong_key" });
    expect(next).toEqual({ tag: "open_failed", kind: "wrong_key" });
    expect("opened" in next).toBe(false);
  });

  it("ignores unrelated events", () => {
    expect(reduce(verifying, { type: "ADVANCE" })).toBe(verifying);
    expect(reduce(verifying, { type: "START" })).toBe(verifying);
  });
});

// --- one path to recall (spec 10 C1) -----------------------------------------

describe("single recall path (spec 10 C1)", () => {
  it("OPENED from verifying and from unlocking reach recall the same way", () => {
    const unlocking: FlowState = {
      tag: "unlocking",
      envelope: {},
      envelopeHash: "h",
      unlock: { passkey: null, backup: true },
    };
    const viaUnlock = reduce(unlocking, { type: "OPENED", opened: OPENED });
    const viaVerify = reduce({ tag: "verifying" }, { type: "OPENED", opened: OPENED });
    expect(viaUnlock).toEqual(viaVerify);
    expect(viaUnlock.tag).toBe("recall");
  });
});

// --- text question cap (spec 10 C3.9) ----------------------------------------

describe("text question cap (spec 10 C3.9)", () => {
  const withPayload = (payload: PayloadV1): Opened => ({ ...OPENED, payload });
  const unlocking: FlowState = {
    tag: "unlocking",
    envelope: {},
    envelopeHash: "h",
    unlock: { passkey: null, backup: true },
  };

  it("enters recall with one draft per question at three text questions", () => {
    const next = reduce(unlocking, {
      type: "OPENED",
      opened: withPayload(PAYLOAD_TEXT_3),
    });
    if (next.tag !== "recall") throw new Error("expected recall");
    expect(Object.keys(next.drafts).sort()).toEqual(
      PAYLOAD_TEXT_3.recall_questions.map((q) => q.id).sort(),
    );
  });

  it("returns invalid_payload from unlocking with four text questions", () => {
    expect(
      reduce(unlocking, { type: "OPENED", opened: withPayload(PAYLOAD_TEXT_4) }),
    ).toEqual({ tag: "open_failed", kind: "invalid_payload" });
  });

  it("returns invalid_payload from verifying with four text questions", () => {
    expect(
      reduce(
        { tag: "verifying" },
        { type: "OPENED", opened: withPayload(PAYLOAD_TEXT_4) },
      ),
    ).toEqual({ tag: "open_failed", kind: "invalid_payload" });
  });
});

// A failed load, hash check or opening renders its FlowError and carries no
// recall question (spec 10 C1.4). Every error tag holds no Opened, so its view
// cannot show a question.
describe("error states hold no recall question (spec 10 C1.4)", () => {
  it("a failed hash check never reaches recall", () => {
    const failed = run(
      { type: "LETTER_OPENABLE", envelope: {}, envelopeHash: "h" },
      { type: "SECRET_OK" },
      { type: "VERIFICATION_FAILED" },
    );
    expect(failed.tag).toBe("verification_failed");
    expect("opened" in failed).toBe(false);
  });
});

// --- recall ------------------------------------------------------------------

describe("recall", () => {
  it("EDIT_DRAFT updates one draft's text and leaves others", () => {
    const next = reduce(recallState(), {
      type: "EDIT_DRAFT",
      id: "q1",
      text: "3.41",
    });
    if (next.tag !== "recall") throw new Error("expected recall");
    expect(next.drafts.q1).toEqual({ text: "3.41", noAnswer: false });
    expect(next.drafts.q2).toEqual({ text: "", noAnswer: false });
  });

  it("TOGGLE_NO_ANSWER sets the toggle without touching text", () => {
    const edited = reduce(recallState(), {
      type: "EDIT_DRAFT",
      id: "q1",
      text: "9",
    });
    const next = reduce(edited, {
      type: "TOGGLE_NO_ANSWER",
      id: "q1",
      noAnswer: true,
    });
    if (next.tag !== "recall") throw new Error("expected recall");
    expect(next.drafts.q1).toEqual({ text: "9", noAnswer: true });
  });

  it("SUBMIT_INVALID records the invalid ids and keeps the drafts", () => {
    const next = reduce(recallState(), {
      type: "SUBMIT_INVALID",
      invalid: ["q2"],
    });
    if (next.tag !== "recall") throw new Error("expected recall");
    expect(next.invalid).toEqual(["q2"]);
    expect(next.drafts.q2).toEqual({ text: "", noAnswer: false });
  });

  it("editing a question clears it from invalid", () => {
    const flagged = reduce(recallState(), {
      type: "SUBMIT_INVALID",
      invalid: ["q1", "q2"],
    });
    const next = reduce(flagged, { type: "EDIT_DRAFT", id: "q1", text: "4" });
    if (next.tag !== "recall") throw new Error("expected recall");
    expect(next.invalid).toEqual(["q2"]);
  });

  it("RECORD_SEALED -> submitting carrying record and sealed bytes", () => {
    const next = reduce(recallState(), {
      type: "RECORD_SEALED",
      record: RECORD,
      sealed: SEALED,
    });
    expect(next.tag).toBe("submitting");
    if (next.tag !== "submitting") throw new Error("unreachable");
    expect(next.record).toBe(RECORD);
    expect(next.sealed).toBe(SEALED);
  });

  it("ignores POST_OK, RETRY_POST and START", () => {
    const recall = recallState();
    expect(reduce(recall, { type: "POST_OK" })).toBe(recall);
    expect(reduce(recall, { type: "RETRY_POST" })).toBe(recall);
    expect(reduce(recall, { type: "START" })).toBe(recall);
  });
});

// --- submitting (single submission, R8.9) ------------------------------------

describe("submitting", () => {
  it("POST_OK -> reveal at stage 1 (R8.1, R9.1)", () => {
    const next = reduce(submittingState(), { type: "POST_OK" });
    expect(next.tag).toBe("reveal");
    if (next.tag !== "reveal") throw new Error("unreachable");
    expect(next.stage).toBe(1);
    expect(next.record).toBe(RECORD);
  });

  it("POST_FAILED -> submit_failed keeping the same sealed bytes (R8.7)", () => {
    const next = reduce(submittingState(), { type: "POST_FAILED" });
    expect(next.tag).toBe("submit_failed");
    if (next.tag !== "submit_failed") throw new Error("unreachable");
    expect(next.record).toBe(RECORD);
    expect(next.sealed).toBe(SEALED);
  });

  it("ignores SUBMIT and RETRY_POST (R8.9)", () => {
    const submitting = submittingState();
    // SUBMIT is not a reducer event; the closest re-submit trigger is
    // RECORD_SEALED, which must also be ignored while submitting.
    expect(reduce(submitting, { type: "RETRY_POST" })).toBe(submitting);
    expect(
      reduce(submitting, { type: "RECORD_SEALED", record: RECORD, sealed: SEALED }),
    ).toBe(submitting);
  });
});

// --- submit_failed (retry resends identical bytes, R8.7) ---------------------

describe("submit_failed", () => {
  function submitFailedState(): FlowState {
    return reduce(submittingState(), { type: "POST_FAILED" });
  }

  it("RETRY_POST -> submitting resending the identical ciphertext and nonce", () => {
    const failed = submitFailedState();
    if (failed.tag !== "submit_failed") throw new Error("expected submit_failed");
    const next = reduce(failed, { type: "RETRY_POST" });
    expect(next.tag).toBe("submitting");
    if (next.tag !== "submitting") throw new Error("unreachable");
    // Identical bytes, same reference: the retry posts exactly what was sealed.
    expect(next.sealed).toBe(failed.sealed);
    expect(next.sealed.ciphertext).toBe(SEALED.ciphertext);
    expect(next.sealed.nonce).toBe(SEALED.nonce);
    expect(next.record).toBe(failed.record);
  });

  it("ignores every other event", () => {
    const failed = submitFailedState();
    expect(reduce(failed, { type: "POST_OK" })).toBe(failed);
    expect(reduce(failed, { type: "START" })).toBe(failed);
    expect(reduce(failed, { type: "ADVANCE" })).toBe(failed);
  });
});

// --- reveal (pacing) ---------------------------------------------------------

describe("reveal", () => {
  function revealState(): FlowState {
    return reduce(submittingState(), { type: "POST_OK" });
  }

  it("ADVANCE increments the stage one at a time up to 3", () => {
    let state = revealState();
    expect(state.tag === "reveal" && state.stage).toBe(1);
    state = reduce(state, { type: "ADVANCE" });
    expect(state.tag === "reveal" && state.stage).toBe(2);
    state = reduce(state, { type: "ADVANCE" });
    expect(state.tag === "reveal" && state.stage).toBe(3);
  });

  it("ADVANCE never passes stage 3", () => {
    let state = reduce(reduce(revealState(), { type: "ADVANCE" }), {
      type: "ADVANCE",
    });
    expect(state.tag === "reveal" && state.stage).toBe(3);
    state = reduce(state, { type: "ADVANCE" });
    expect(state.tag === "reveal" && state.stage).toBe(3);
  });

  it("SHOW_ALL jumps straight to stage 3 from stage 1", () => {
    const next = reduce(revealState(), { type: "SHOW_ALL" });
    expect(next.tag === "reveal" && next.stage).toBe(3);
  });

  it("keeps the record across pacing events", () => {
    const next = reduce(revealState(), { type: "ADVANCE" });
    if (next.tag !== "reveal") throw new Error("expected reveal");
    expect(next.record).toBe(RECORD);
  });

  it("ignores unrelated events", () => {
    const reveal = revealState();
    expect(reduce(reveal, { type: "START" })).toBe(reveal);
    expect(reduce(reveal, { type: "POST_OK" })).toBe(reveal);
  });
});

// --- terminal error states hold no Opened ------------------------------------

describe("error states carry no payload and ignore every event", () => {
  const errorStates: FlowState[] = [
    { tag: "not_placed" },
    { tag: "verification_failed" },
    { tag: "open_failed", kind: "tampered" },
  ];

  const everyEvent: FlowEvent[] = [
    { type: "START" },
    { type: "LETTER_SEALED", opensAt: "2030-01-01T00:00:00.000Z" },
    { type: "LETTER_OPENABLE", envelope: {}, envelopeHash: "h" },
    { type: "LETTER_NOT_PLACED" },
    { type: "UNREACHABLE" },
    { type: "SECRET_FORBIDDEN", opensAt: "2030-01-01T00:00:00.000Z" },
    { type: "SECRET_OK" },
    { type: "OPENED", opened: OPENED },
    { type: "VERIFICATION_FAILED" },
    { type: "OPEN_FAILED", kind: "wrong_key" },
    { type: "EDIT_DRAFT", id: "q1", text: "1" },
    { type: "TOGGLE_NO_ANSWER", id: "q1", noAnswer: true },
    { type: "SUBMIT_INVALID", invalid: ["q1"] },
    { type: "RECORD_SEALED", record: RECORD, sealed: SEALED },
    { type: "POST_OK" },
    { type: "POST_FAILED" },
    { type: "RETRY_POST" },
    { type: "ADVANCE" },
    { type: "SHOW_ALL" },
  ];

  for (const state of errorStates) {
    it(`${state.tag} holds no Opened and is unchanged by any event`, () => {
      expect("opened" in state).toBe(false);
      for (const event of everyEvent) {
        expect(reduce(state, event)).toBe(state);
      }
    });
  }
});

// --- unreachable (retry via START) -------------------------------------------

describe("unreachable", () => {
  const unreachable: FlowState = { tag: "unreachable" };

  it("holds no Opened", () => {
    expect("opened" in unreachable).toBe(false);
  });

  it("START -> loading (retry, R7.1)", () => {
    expect(reduce(unreachable, { type: "START" })).toEqual({ tag: "loading" });
  });

  it("ignores every other event", () => {
    expect(reduce(unreachable, { type: "SECRET_OK" })).toBe(unreachable);
    expect(reduce(unreachable, { type: "POST_OK" })).toBe(unreachable);
  });
});
