// Unit tests for the Live_Letter time rules (boundary values).
//
// Feature: 06-lock-and-unlock, Property 2: draft freshness is a strict age bound.
import { describe, expect, it } from "vitest";

import { draftIsFresh, lockRuleHolds } from "./live-rules";

const base = new Date("2026-11-01T12:00:00.000Z").getTime();
const at = (ms: number) => new Date(base + ms);

describe("lockRuleHolds", () => {
  it("holds for a 30 s lock opening 1 ms after now", () => {
    expect(lockRuleHolds(at(0), at(30_000), at(29_999))).toBe(true);
  });

  it("holds when opensAt - now is exactly 60 s", () => {
    expect(lockRuleHolds(at(0), at(30_000), at(-30_000))).toBe(true);
  });

  it("fails when opensAt - now is 60 s plus 1 ms", () => {
    expect(lockRuleHolds(at(0), at(30_000), at(-30_001))).toBe(false);
  });

  it("fails when opensAt equals now (must be strictly after)", () => {
    expect(lockRuleHolds(at(0), at(30_000), at(30_000))).toBe(false);
  });

  it("fails when the lock is 1 ms short of 30 s", () => {
    expect(lockRuleHolds(at(0), at(29_999), at(0))).toBe(false);
  });

  it("fails when the lock is 1 ms over 30 s", () => {
    expect(lockRuleHolds(at(0), at(30_001), at(0))).toBe(false);
  });
});

describe("draftIsFresh", () => {
  it("is true at age 0", () => {
    expect(draftIsFresh(at(0), at(0))).toBe(true);
  });

  it("is true at age 599 999 ms", () => {
    expect(draftIsFresh(at(0), at(599_999))).toBe(true);
  });

  it("is false at exactly 600 000 ms (strict bound)", () => {
    expect(draftIsFresh(at(0), at(600_000))).toBe(false);
  });

  it("is false when the draft is in the future", () => {
    expect(draftIsFresh(at(1), at(0))).toBe(false);
  });
});
