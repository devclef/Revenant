// Property tests for the Live_Letter time rules.
//
// Feature: 06-lock-and-unlock
// - Property 1: the Lock rule holds exactly when the three conditions hold.
// - Property 2: draft freshness is a strict age bound.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { draftIsFresh, lockRuleHolds } from "./live-rules";

const ms = fc.integer({ min: -2_000_000_000, max: 2_000_000_000 });
const toDate = (n: number) => new Date(n);

describe("Property 1: Lock rule", () => {
  it("holds exactly when the three conditions hold", () => {
    fc.assert(
      fc.property(ms, ms, ms, (sealed, opens, now) => {
        const expected =
          opens - sealed === 30_000 && opens > now && opens - now <= 60_000;
        expect(lockRuleHolds(toDate(sealed), toDate(opens), toDate(now))).toBe(
          expected,
        );
      }),
      { numRuns: 2_000 },
    );
  });

  it("holds at every boundary value of opensAt - now", () => {
    fc.assert(
      fc.property(ms, fc.integer({ min: -1, max: 60_001 }), (sealed, gap) => {
        const now = sealed + 30_000 - gap;
        const opens = sealed + 30_000;
        const expected = gap > 0 && gap <= 60_000;
        expect(lockRuleHolds(toDate(sealed), toDate(opens), toDate(now))).toBe(
          expected,
        );
      }),
      { numRuns: 1_000 },
    );
  });
});

describe("Property 2: draft freshness", () => {
  it("is true iff 0 <= T - createdAt < 600000", () => {
    fc.assert(
      fc.property(ms, ms, (createdAt, now) => {
        const age = now - createdAt;
        const expected = age >= 0 && age < 600_000;
        expect(draftIsFresh(toDate(createdAt), toDate(now))).toBe(expected);
      }),
      { numRuns: 2_000 },
    );
  });

  it("flips exactly at the 600000 ms boundary", () => {
    fc.assert(
      fc.property(ms, (createdAt) => {
        expect(draftIsFresh(toDate(createdAt), toDate(createdAt + 599_999))).toBe(
          true,
        );
        expect(draftIsFresh(toDate(createdAt), toDate(createdAt + 600_000))).toBe(
          false,
        );
      }),
      { numRuns: 500 },
    );
  });
});
