// Feature: 19-real-sealing-stepper (design 2, pressStatusLine needsDate input)

import { describe, expect, it } from "vitest";

import { REAL_COPY } from "../copy";
import { PRESS_COPY } from "../press/copy";
import { pressStatusLine } from "./press-status";

describe("pressStatusLine needsDate input (spec 19)", () => {
  it("keeps today's output when needsDate is omitted or false", () => {
    for (const tag of ["write", "creating", "created", "confirming", "preparing", "sealing"] as const) {
      for (const backupChoice of [null, "card", "skip"] as const) {
        for (const motion of ["full", "reduced", "calm"] as const) {
          expect(pressStatusLine({ tag, backupChoice, motion })).toEqual(
            pressStatusLine({ tag, backupChoice, motion, needsDate: false }),
          );
        }
      }
    }
  });

  it("returns REAL_COPY.pressNeedsDate for write with a choice and no date", () => {
    expect(
      pressStatusLine({ tag: "write", backupChoice: "card", motion: "full", needsDate: true }),
    ).toEqual({ text: REAL_COPY.pressNeedsDate, tone: "muted" });
    expect(REAL_COPY.pressNeedsDate).toBe("Choose an opening date first.");
  });

  it("still asks for a backup choice first when none is made", () => {
    expect(
      pressStatusLine({ tag: "write", backupChoice: null, motion: "full", needsDate: true }).text,
    ).toBe(PRESS_COPY.chooseFirst);
  });

  it("ignores needsDate outside the write state", () => {
    expect(
      pressStatusLine({ tag: "sealing", backupChoice: "card", motion: "full", needsDate: true }),
    ).toEqual(pressStatusLine({ tag: "sealing", backupChoice: "card", motion: "full" }));
  });
});
