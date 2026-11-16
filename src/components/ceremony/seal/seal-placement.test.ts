import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  BREAK_SEAL_MAX_PX,
  BREAK_SEAL_MIN_PX,
  BREAK_SEAL_VW,
  SEAL_ON_ENVELOPE_MIN_PX,
  breakSealWidthPx,
  sealPlacement,
} from "./seal-placement";

const here = dirname(fileURLToPath(import.meta.url));

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

/**
 * The Break the seal width (spec 13 U8.1, U8.2). The seal is at least 160 CSS px
 * wide at 1440 and at least 120 CSS px wide at 390. The same rule is in
 * scene/tokens.css as --break-seal-d, and the last test checks the two agree.
 */
describe("breakSealWidthPx: the Break the seal size contract (U8.1, U8.2)", () => {
  it("is at least 160 CSS px wide at 1440", () => {
    expect(breakSealWidthPx(1440)).toBeGreaterThanOrEqual(160);
    expect(breakSealWidthPx(1440)).toBe(160);
  });

  it("is at least 120 CSS px wide at the phone widths 360 and 390", () => {
    expect(breakSealWidthPx(360)).toBeGreaterThanOrEqual(120);
    expect(breakSealWidthPx(390)).toBeGreaterThanOrEqual(120);
    expect(breakSealWidthPx(390)).toBe(120);
  });

  it("stays at the 160 px ceiling on the widest screens", () => {
    expect(breakSealWidthPx(2560)).toBe(160);
  });

  it("switches from the floor to the fluid share at 12vw, and holds the ceiling from 1334 px", () => {
    expect(breakSealWidthPx(899)).toBe(120);
    expect(breakSealWidthPx(1100)).toBeCloseTo(132, 5);
    expect(breakSealWidthPx(1333)).toBeCloseTo(159.96, 2);
    expect(breakSealWidthPx(1334)).toBe(160);
  });

  it("agrees with the --break-seal-d token in scene/tokens.css", () => {
    const tokens = readFileSync(resolve(here, "../scene/tokens.css"), "utf8");
    expect(tokens).toContain(`--break-seal-d: clamp(${BREAK_SEAL_MIN_PX}px, ${BREAK_SEAL_VW}vw, ${BREAK_SEAL_MAX_PX}px);`);
  });
});
