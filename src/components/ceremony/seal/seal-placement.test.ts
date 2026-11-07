import { describe, expect, it } from "vitest";

import { SEAL_ON_ENVELOPE_MIN_PX, sealPlacement } from "./seal-placement";

/**
 * The seal's width classes (spec 09 C5.1). Phone_Sizes are 360 and 390 CSS px;
 * the tablet band is 600 to 899 px; Desktop_Sizes start at 900 px; the
 * Wide_Size is 2560 px.
 */
const PHONE = [360, 390];
const TABLET = [768];
const DESKTOP = [1280, 1366, 1440];
const WIDE = [2560];

describe("sealPlacement: width classes (spec 09 C5.1, C5.2)", () => {
  it("keeps the seal in the Content_Column at the Phone_Sizes, even with the Envelope mounted", () => {
    for (const viewportWidth of PHONE) {
      expect(sealPlacement({ viewportWidth, slotReady: true })).toBe("content");
    }
  });

  it("keeps the seal in the Content_Column in the tablet band below 900 px", () => {
    for (const viewportWidth of TABLET) {
      expect(sealPlacement({ viewportWidth, slotReady: true })).toBe("content");
    }
  });

  it("puts the seal on the held Envelope at the Desktop_Sizes", () => {
    for (const viewportWidth of DESKTOP) {
      expect(sealPlacement({ viewportWidth, slotReady: true })).toBe("envelope");
    }
  });

  it("puts the seal on the held Envelope at the Wide_Size", () => {
    for (const viewportWidth of WIDE) {
      expect(sealPlacement({ viewportWidth, slotReady: true })).toBe("envelope");
    }
  });

  it("switches exactly at the 900 px breakpoint", () => {
    expect(SEAL_ON_ENVELOPE_MIN_PX).toBe(900);
    expect(sealPlacement({ viewportWidth: 899, slotReady: true })).toBe("content");
    expect(sealPlacement({ viewportWidth: 900, slotReady: true })).toBe("envelope");
  });
});

describe("sealPlacement: no Envelope or no width yet (the fallback)", () => {
  it("keeps the seal in the Content_Column at a Desktop_Size until the Envelope slot is mounted", () => {
    // The server render and the first client render have no slot. The seal
    // stays where it was until the slot exists, so the hydrated markup matches.
    expect(sealPlacement({ viewportWidth: 1280, slotReady: false })).toBe("content");
    expect(sealPlacement({ viewportWidth: 2560, slotReady: false })).toBe("content");
  });

  it("keeps the seal in the Content_Column while the viewport width is unknown", () => {
    expect(sealPlacement({ viewportWidth: null, slotReady: true })).toBe("content");
  });
});
