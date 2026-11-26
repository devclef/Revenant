// Feature: 20-easier-sealing-and-receipts (Part C).
//
// sealButtonLabel must read PRESS_COPY.sealButtonCreate and sealButtonSet.
// The two press-list keys (stepOne, stepTwo) hold the same text today, so
// equal values alone cannot show which keys are read. This test replaces
// every PRESS_COPY value with a unique sentinel, so only the keys the button
// actually reads can appear in its label.

import { describe, expect, it, vi } from "vitest";

vi.mock("../press/copy", async (importOriginal) => {
  const original = await importOriginal<typeof import("../press/copy")>();
  const sentinels = Object.fromEntries(
    Object.keys(original.PRESS_COPY).map((key) => [key, `SENTINEL:${key}`]),
  );
  return { ...original, PRESS_COPY: { ...original.PRESS_COPY, ...sentinels } };
});

import { sealButtonLabel } from "./seal-button";
import type { PressStatusTag } from "./press-status";

const CREATE_TAGS: PressStatusTag[] = ["write", "creating"];
const SET_TAGS: PressStatusTag[] = [
  "created",
  "confirming",
  "preparing",
  "sealing",
];

describe("sealButtonLabel reads the Seal_Button copy keys", () => {
  it.each(CREATE_TAGS)("returns sealButtonCreate for %s", (tag) => {
    expect(sealButtonLabel(tag)).toBe("SENTINEL:sealButtonCreate");
  });

  it.each(SET_TAGS)("returns sealButtonSet for %s", (tag) => {
    expect(sealButtonLabel(tag)).toBe("SENTINEL:sealButtonSet");
  });

  it("never returns the press-list keys stepOne or stepTwo", () => {
    const all = [...CREATE_TAGS, ...SET_TAGS];
    for (const tag of all) {
      const label = sealButtonLabel(tag);
      expect(label).not.toBe("SENTINEL:stepOne");
      expect(label).not.toBe("SENTINEL:stepTwo");
    }
  });
});
