// Feature: 16-remember-first (Requirement 2, Proposed wording)
//
// Exact-string checks for the Remember wording on the Write desk. The
// receipt intro is the one Requirement 2 row this desk owns.

import { describe, expect, it } from "vitest";
import { DESK_COPY } from "./copy";

describe("DESK_COPY Remember wording (spec 16, Requirement 2)", () => {
  it("has the receipt intro exactly", () => {
    expect(DESK_COPY.receiptIntro).toBe(
      "A number sealed with its date. When it opens, you remember it first, then see it beside the record at opening.",
    );
  });

  it("does not use the retired guess wording in the receipt intro", () => {
    expect(DESK_COPY.receiptIntro).not.toMatch(/guess|testif|testimon/i);
  });
});
