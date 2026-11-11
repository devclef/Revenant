// Feature: 09-demo-polish (spec 09 C5.1, C5.5)
//
// The held Envelope in reveal stage 1 by width class. At the Desktop_Sizes
// (1280 and 1366 px) and the Wide_Size (2560 px) the Ghost holds the Envelope
// and the seal sits on it. At the Phone_Sizes (360 and 390 px) the Envelope is
// not held in stage 1, so the Compact_Ghost carries it without covering the
// top-right of the recall card. Before the width is read (null) the Envelope is
// not held in stage 1, which matches the server markup.

import { describe, expect, it } from "vitest";

import { holdsEnvelope, showsHeldDates } from "./held-envelope";

const PHONE_WIDTHS = [360, 390];
const DESKTOP_AND_WIDE_WIDTHS = [900, 1280, 1366, 2560];

describe("holdsEnvelope in reveal stage 1 (spec 09 C5.1)", () => {
  for (const viewportWidth of DESKTOP_AND_WIDE_WIDTHS) {
    it(`holds the Envelope at marks and seal at ${viewportWidth} px`, () => {
      expect(holdsEnvelope({ tag: "reveal", stage: 1, viewportWidth })).toBe(
        true,
      );
    });
  }

  for (const viewportWidth of PHONE_WIDTHS) {
    it(`does not hold the Envelope at marks and seal at ${viewportWidth} px (the Compact_Ghost carries it)`, () => {
      expect(holdsEnvelope({ tag: "reveal", stage: 1, viewportWidth })).toBe(
        false,
      );
    });
  }

  it("does not hold the Envelope in stage 1 before the width is read (matches the server markup)", () => {
    expect(
      holdsEnvelope({ tag: "reveal", stage: 1, viewportWidth: null }),
    ).toBe(false);
  });

  it("does not hold the Envelope at the later stages at any width", () => {
    for (const stage of [2, 3]) {
      for (const viewportWidth of [
        ...PHONE_WIDTHS,
        ...DESKTOP_AND_WIDE_WIDTHS,
      ]) {
        expect(holdsEnvelope({ tag: "reveal", stage, viewportWidth })).toBe(
          false,
        );
      }
    }
  });
});

describe("holdsEnvelope before the reveal is unchanged by width (spec 09 C5.5)", () => {
  const heldTags = [
    "loading",
    "openable",
    "verifying",
    "awaiting_key",
    "unlocking",
    "sealed",
  ] as const;

  for (const tag of heldTags) {
    it(`holds the Envelope in ${tag} at a phone and at a desktop width`, () => {
      for (const viewportWidth of [360, 1280]) {
        expect(holdsEnvelope({ tag, stage: null, viewportWidth })).toBe(true);
      }
    });
  }

  it("holds the Envelope in sealed before the width is read", () => {
    expect(
      holdsEnvelope({ tag: "sealed", stage: null, viewportWidth: null }),
    ).toBe(true);
  });

  it("holds the Envelope in recall, submitting and submit_failed (spec 10 C1.5)", () => {
    for (const tag of ["recall", "submitting", "submit_failed"] as const) {
      expect(holdsEnvelope({ tag, stage: null, viewportWidth: 1280 })).toBe(
        true,
      );
    }
  });
});

// Spec 11 P3.1: the held Envelope's date lines are off on the recall card tags,
// because TestifyContext states the dates there, and on for every other tag.
describe("showsHeldDates (spec 11 P3.1)", () => {
  for (const tag of ["recall", "submitting", "submit_failed"] as const) {
    it(`hides the held Envelope dates on the ${tag} card`, () => {
      expect(showsHeldDates(tag)).toBe(false);
    });
  }

  for (const tag of [
    "loading",
    "sealed",
    "openable",
    "verifying",
    "reveal",
  ] as const) {
    it(`shows the held Envelope dates on ${tag}`, () => {
      expect(showsHeldDates(tag)).toBe(true);
    });
  }
});
