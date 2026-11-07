// Feature: 09-demo-polish (spec 09 C5.1, C5.5)
//
// The held Envelope in reveal stage 1 by width class. At the Desktop_Sizes
// (1280 and 1366 px) and the Wide_Size (2560 px) the Ghost holds the Envelope
// and the seal sits on it. At the Phone_Sizes (360 and 390 px) the Envelope is
// not held in stage 1, so the Compact_Ghost carries it without covering the
// top-right of the recall card. Before the width is read (null) the Envelope is
// not held in stage 1, which matches the server markup.

import { describe, expect, it } from "vitest";

import { holdsEnvelope } from "./held-envelope";

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
    "verified",
  ] as const;

  for (const tag of heldTags) {
    it(`holds the Envelope in ${tag} at a phone and at a desktop width`, () => {
      for (const viewportWidth of [360, 1280]) {
        expect(holdsEnvelope({ tag, stage: null, viewportWidth })).toBe(true);
      }
    });
  }

  it("holds the Envelope in verified before the width is read", () => {
    expect(
      holdsEnvelope({ tag: "verified", stage: null, viewportWidth: null }),
    ).toBe(true);
  });

  it("does not hold the Envelope in recall or submitting", () => {
    for (const tag of ["recall", "submitting", "submit_failed"] as const) {
      expect(holdsEnvelope({ tag, stage: null, viewportWidth: 1280 })).toBe(
        false,
      );
    }
  });
});
