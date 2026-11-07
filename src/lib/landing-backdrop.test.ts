// Feature: 09-demo-polish (B1.5, P1.1, P2.1, OD12 c)
//
// Asserts the OD12 values in landing-backdrop.ts. These are constants only:
// this file does not test the rendered layout. The rendered Ghost and light
// position is not yet set, so it is not asserted here. The stylesheet value for
// the reserved Ghost box is checked in src/components/landing/constants.test.ts.

import { describe, expect, it } from "vitest";

import {
  PHONE_GHOST_PLACEMENT,
  phoneGhostHeightPx,
  usesPhoneGhostPlacement,
} from "./landing-backdrop";

describe("landing backdrop phone placement (OD12 c)", () => {
  it("places the Ghost after the calls to action, centred on the light", () => {
    expect(PHONE_GHOST_PLACEMENT.after).toBe("calls-to-action");
    expect(PHONE_GHOST_PLACEMENT.lightCentre).toBe("ghost-centre");
  });

  it("uses the phone placement below 600 px and not at 600 px", () => {
    expect(usesPhoneGhostPlacement(360)).toBe(true);
    expect(usesPhoneGhostPlacement(390)).toBe(true);
    expect(usesPhoneGhostPlacement(599)).toBe(true);
    expect(usesPhoneGhostPlacement(600)).toBe(false);
  });

  it("keeps the Ghost box at most 30% of the viewport height at both Phone_Sizes", () => {
    // 360x640 and 390x844 (Group P).
    expect(phoneGhostHeightPx(640)).toBeLessThanOrEqual(640 * 0.3);
    expect(phoneGhostHeightPx(844)).toBeLessThanOrEqual(844 * 0.3);
  });

  it("caps the Ghost box at 190 px", () => {
    expect(phoneGhostHeightPx(640)).toBe(190);
    expect(phoneGhostHeightPx(844)).toBe(190);
  });

  it("uses 30% of the height when that is smaller than the cap", () => {
    expect(phoneGhostHeightPx(400)).toBeCloseTo(120, 6);
  });
});
