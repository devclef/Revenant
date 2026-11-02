/**
 * The write step's held state across Try again (spec 06-lock-and-unlock,
 * R15.7). SealPage keeps the letter text, the chosen figures and the warning
 * tick in reduceWriteDraft's state, and the flow reducer (sealReducer) moves
 * through the cancelled screen and back. These tests drive both reducers in the
 * order the page does and check that the three values are still there.
 *
 * The project has no DOM test library, so the page itself is not rendered here.
 * The page passes this state to WriteForm as controlled props, and SealPage
 * owns the reducer, so this is the same state the rendered page holds.
 */

import { describe, expect, it } from "vitest";

import { MAX_FIGURES } from "./constants";
import { sealReducer, INITIAL_SEAL_STATE } from "./seal-machine";
import {
  INITIAL_WRITE_DRAFT,
  reduceWriteDraft,
  type WriteDraft,
} from "./write-draft";

function typeLetter(draft: WriteDraft, text: string): WriteDraft {
  return reduceWriteDraft(draft, { type: "TEXT_CHANGED", text });
}

describe("the write draft starts empty", () => {
  it("has no letter, no figures and an unticked warning", () => {
    expect(INITIAL_WRITE_DRAFT).toEqual({
      text: "",
      metricIds: [],
      warningTicked: false,
    });
  });
});

describe("Try again keeps the letter, the figures and the warning (R15.7)", () => {
  it("restores all three after a cancelled create", () => {
    let draft = typeLetter(INITIAL_WRITE_DRAFT, "A letter for next year.");
    draft = reduceWriteDraft(draft, {
      type: "FIGURE_TOGGLED",
      metricId: "us-gasoline-regular",
    });
    draft = reduceWriteDraft(draft, { type: "WARNING_CHANGED", ticked: true });

    // The page's flow: Create_Press, then the passkey prompt is cancelled,
    // then Try again. The flow reducer does not touch the draft.
    let flow = sealReducer(INITIAL_SEAL_STATE, { type: "CREATE_PRESS" });
    flow = sealReducer(flow, { type: "CANCELLED" });
    expect(flow.tag).toBe("cancelled");
    flow = sealReducer(flow, { type: "RETRY" });
    expect(flow.tag).toBe("write");

    expect(draft.text).toBe("A letter for next year.");
    expect(draft.metricIds).toEqual(["us-gasoline-regular"]);
    expect(draft.warningTicked).toBe(true);
  });

  it("restores all three after a failed create and a cannot_lock", () => {
    let draft = typeLetter(INITIAL_WRITE_DRAFT, "Kept.");
    draft = reduceWriteDraft(draft, { type: "WARNING_CHANGED", ticked: true });

    let flow = sealReducer(INITIAL_SEAL_STATE, { type: "CREATE_PRESS" });
    flow = sealReducer(flow, {
      type: "FAILED",
      kind: "server",
      passkeyCreated: false,
    });
    expect(flow.tag).toBe("failed");
    flow = sealReducer(flow, { type: "RETRY" });

    let locked = sealReducer(INITIAL_SEAL_STATE, { type: "CREATE_PRESS" });
    locked = sealReducer(locked, {
      type: "CANNOT_LOCK",
      passkeyCreated: false,
    });
    expect(locked.tag).toBe("cannot_lock");

    expect(draft.text).toBe("Kept.");
    expect(draft.warningTicked).toBe(true);
  });
});

describe("figure picks", () => {
  it("unpicks a figure that is already chosen", () => {
    let draft = reduceWriteDraft(INITIAL_WRITE_DRAFT, {
      type: "FIGURE_TOGGLED",
      metricId: "a",
    });
    draft = reduceWriteDraft(draft, { type: "FIGURE_TOGGLED", metricId: "a" });
    expect(draft.metricIds).toEqual([]);
  });

  it("refuses a figure past the limit", () => {
    let draft = INITIAL_WRITE_DRAFT;
    for (let i = 0; i < MAX_FIGURES; i += 1) {
      draft = reduceWriteDraft(draft, {
        type: "FIGURE_TOGGLED",
        metricId: `m-${i}`,
      });
    }
    const full = reduceWriteDraft(draft, {
      type: "FIGURE_TOGGLED",
      metricId: "one-too-many",
    });
    expect(full.metricIds).toHaveLength(MAX_FIGURES);
    expect(full.metricIds).not.toContain("one-too-many");
  });
});
