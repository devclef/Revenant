// Unit tests for the server-only `isOpenable` clock helper.
//
// `isOpenable` is the single pure function the letter routes use to decide
// whether a letter's opening date has arrived. These tests cover the three
// boundary cases around `opensAt` (before, after, exactly equal) and the
// Property-16 reflexive sub-case `isOpenable(t, t) === true`.
//
// R6.5: equal-to-the-millisecond counts as open, so the comparison is `>=`.
//
// Feature: 02-sealed-letters, Property 16: a letter is open at its own opening instant

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { isOpenable } from "./clock";

describe("isOpenable", () => {
  it("is false when now is before opensAt", () => {
    const opensAt = new Date("2026-06-01T00:00:00.000Z");
    const now = new Date("2026-05-31T23:59:59.999Z");
    expect(isOpenable(opensAt, now)).toBe(false);
  });

  it("is true when now is after opensAt", () => {
    const opensAt = new Date("2026-06-01T00:00:00.000Z");
    const now = new Date("2026-06-01T00:00:00.001Z");
    expect(isOpenable(opensAt, now)).toBe(true);
  });

  it("is true when now equals opensAt to the millisecond (R6.5)", () => {
    const opensAt = new Date("2026-06-01T00:00:00.000Z");
    const now = new Date("2026-06-01T00:00:00.000Z");
    // Distinct Date instances with the same millisecond value.
    expect(opensAt).not.toBe(now);
    expect(isOpenable(opensAt, now)).toBe(true);
  });

  it("is true one millisecond after opensAt and false one millisecond before", () => {
    const opensAt = new Date("2026-06-01T00:00:00.000Z");
    const justBefore = new Date(opensAt.getTime() - 1);
    const justAfter = new Date(opensAt.getTime() + 1);
    expect(isOpenable(opensAt, justBefore)).toBe(false);
    expect(isOpenable(opensAt, justAfter)).toBe(true);
  });

  // Feature: 02-sealed-letters, Property 16: isOpenable(t, t) === true for every t.
  it("is reflexively true: isOpenable(t, t) === true for several t", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -8640000000000000, max: 8640000000000000 }),
        (ms) => {
          const t = new Date(ms);
          return isOpenable(t, t) === true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
