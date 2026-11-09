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
import { LIVE_COPY } from "./copy";
import { sealReducer, INITIAL_SEAL_STATE } from "./seal-machine";
import {
  CLEARED_WRITE_DRAFT,
  INITIAL_WRITE_DRAFT,
  initialWriteDraft,
  reduceWriteDraft,
  type WriteDraft,
} from "./write-draft";

function typeLetter(draft: WriteDraft, text: string): WriteDraft {
  return reduceWriteDraft(draft, { type: "TEXT_CHANGED", text });
}

describe("the write draft starts empty", () => {
  it("has no letter, no figures, an unticked warning and the demo prefill row", () => {
    expect(INITIAL_WRITE_DRAFT).toEqual({
      text: "",
      metricIds: [],
      warningTicked: false,
      backupCardTicked: false,
      questions: [LIVE_COPY.livePrefill],
      selfReported: [],
    });
  });

  it("starts a real letter with no question rows (C2.13, C9.5)", () => {
    expect(initialWriteDraft("real")).toEqual({
      text: "",
      metricIds: [],
      warningTicked: false,
      backupCardTicked: false,
      questions: [],
      selfReported: [],
    });
  });
});

describe("the self-reported rows (R1)", () => {
  const row = (name: string) => ({
    name,
    value: "3.4125",
    unit: "USD per gallon",
    region: "U.S. city average",
    period: "2026-09",
  });

  it("adds an empty row, edits it as typed and removes it", () => {
    let draft = reduceWriteDraft(INITIAL_WRITE_DRAFT, { type: "SELF_REPORTED_ADDED" });
    expect(draft.selfReported).toEqual([
      { name: "", value: "", unit: "", region: "", period: "" },
    ]);
    draft = reduceWriteDraft(draft, {
      type: "SELF_REPORTED_CHANGED",
      index: 0,
      field: "name",
      text: "  My rent  ",
    });
    expect(draft.selfReported[0]?.name).toBe("  My rent  ");
    draft = reduceWriteDraft(draft, { type: "SELF_REPORTED_REMOVED", index: 0 });
    expect(draft.selfReported).toEqual([]);
  });

  it("changes only the named row and field", () => {
    let draft = { ...INITIAL_WRITE_DRAFT, selfReported: [row("a"), row("b")] };
    draft = reduceWriteDraft(draft, {
      type: "SELF_REPORTED_CHANGED",
      index: 1,
      field: "value",
      text: "10",
    });
    expect(draft.selfReported[0]).toEqual(row("a"));
    expect(draft.selfReported[1]).toEqual({ ...row("b"), value: "10" });
  });

  it("refuses an eleventh row (at most 10)", () => {
    let draft = INITIAL_WRITE_DRAFT;
    for (let i = 0; i < 10; i += 1) {
      draft = reduceWriteDraft(draft, { type: "SELF_REPORTED_ADDED" });
    }
    expect(draft.selfReported).toHaveLength(10);
    const full = reduceWriteDraft(draft, { type: "SELF_REPORTED_ADDED" });
    expect(full.selfReported).toHaveLength(10);
  });

  it("keeps the rows through Try again, as the other draft fields do (R15.7)", () => {
    let draft = reduceWriteDraft(INITIAL_WRITE_DRAFT, { type: "SELF_REPORTED_ADDED" });
    draft = reduceWriteDraft(draft, {
      type: "SELF_REPORTED_CHANGED",
      index: 0,
      field: "unit",
      text: "USD per gallon",
    });
    let flow = sealReducer(INITIAL_SEAL_STATE, { type: "CREATE_PRESS" });
    flow = sealReducer(flow, { type: "CANCELLED" });
    flow = sealReducer(flow, { type: "RETRY" });
    expect(flow.tag).toBe("write");
    expect(draft.selfReported[0]?.unit).toBe("USD per gallon");
  });

  it("starts a real letter with no rows and clears them after a 201", () => {
    expect(initialWriteDraft("real").selfReported).toEqual([]);
    expect(CLEARED_WRITE_DRAFT.selfReported).toEqual([]);
  });
});

describe("the backup key card box (R21.1)", () => {
  it("starts unticked and ticks and unticks on its own event", () => {
    const ticked = reduceWriteDraft(INITIAL_WRITE_DRAFT, { type: "BACKUP_CARD_CHANGED", ticked: true });
    expect(ticked.backupCardTicked).toBe(true);
    const unticked = reduceWriteDraft(ticked, { type: "BACKUP_CARD_CHANGED", ticked: false });
    expect(unticked.backupCardTicked).toBe(false);
  });

  it("leaves the warning tick alone", () => {
    const warned = reduceWriteDraft(INITIAL_WRITE_DRAFT, { type: "WARNING_CHANGED", ticked: true });
    const next = reduceWriteDraft(warned, { type: "BACKUP_CARD_CHANGED", ticked: true });
    expect(next.warningTicked).toBe(true);
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
