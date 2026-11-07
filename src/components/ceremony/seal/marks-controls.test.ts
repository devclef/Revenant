// Feature: 09-demo-polish (spec 09 C4.1 to C4.3, P8.1 to P8.2)
//
// Pure tests for the Skip_Link rules, the hold ring and the seal's copy. The
// marks control set itself is rendered and checked in
// src/components/reveal/Reveal.marks.test.tsx.

import { describe, expect, it, vi } from "vitest";

import { HOLD_PROGRESS_SEGMENTS, SEAL_HOLD_MS, SEAL_SETTLE_MS } from "../constants";
import { CEREMONY_COPY } from "../copy";
import {
  IDLE,
  holdSegmentsLit,
  isBreak,
  onPress,
  onRelease,
  onTick,
  type HoldState,
} from "./hold";
import { activateSkipLink, skipLinkVisible, type SkipLinkSeal } from "./skip-link";

describe("Skip_Link copy (spec 09 C4.2)", () => {
  it("reads 'Skip to the receipts'", () => {
    expect(CEREMONY_COPY.skipToReceipts).toBe("Skip to the receipts");
  });
});

describe("Skip_Link visibility (spec 09 C4.3)", () => {
  it("shows while the parent asks for it and the seal is intact", () => {
    expect(skipLinkVisible(true, false)).toBe(true);
  });

  it("is hidden when the parent does not ask for it (no part of the Reveal is hidden)", () => {
    expect(skipLinkVisible(false, false)).toBe(false);
  });

  it("is hidden once the seal has broken, so it cannot send again", () => {
    expect(skipLinkVisible(true, true)).toBe(false);
  });
});

describe("Skip_Link event (spec 09 C4.2)", () => {
  /** A controller whose showAll breaks the seal, as useSealBreak's does. */
  function fakeSeal(): SkipLinkSeal & { showAll: ReturnType<typeof vi.fn> } {
    const seal = {
      broken: false,
      showAll: vi.fn(() => {
        seal.broken = true;
      }),
    };
    return seal;
  }

  it("sends SHOW_ALL once on activation", () => {
    const seal = fakeSeal();
    activateSkipLink(seal);
    expect(seal.showAll).toHaveBeenCalledTimes(1);
  });

  it("sends SHOW_ALL once even when activated again", () => {
    const seal = fakeSeal();
    activateSkipLink(seal);
    activateSkipLink(seal);
    activateSkipLink(seal);
    expect(seal.showAll).toHaveBeenCalledTimes(1);
  });
});

/** The segments lit by a hold that reaches `elapsedMs` at the given clock. */
function litAt(elapsedMs: number): boolean[] {
  let s: HoldState = onPress(IDLE, 0);
  s = onTick(s, elapsedMs);
  return holdSegmentsLit(s);
}

describe("hold ring with a fake clock (spec 09 P8.2)", () => {
  it("has HOLD_PROGRESS_SEGMENTS segments, 12", () => {
    expect(HOLD_PROGRESS_SEGMENTS).toBe(12);
    expect(holdSegmentsLit(IDLE)).toHaveLength(12);
  });

  it("lights no segment at idle", () => {
    expect(holdSegmentsLit(IDLE).every((on) => !on)).toBe(true);
  });

  it("lights segment k exactly at k/12 of SEAL_HOLD_MS", () => {
    for (let k = 1; k <= HOLD_PROGRESS_SEGMENTS; k += 1) {
      const at = (k / HOLD_PROGRESS_SEGMENTS) * SEAL_HOLD_MS;
      const lit = litAt(at);
      // Segments 1..k are lit, the rest are not, at the k/12 moment.
      for (let j = 1; j <= HOLD_PROGRESS_SEGMENTS; j += 1) {
        expect(lit[j - 1]).toBe(j <= k);
      }
    }
  });

  it("lights no segment just before the first boundary", () => {
    const first = SEAL_HOLD_MS / HOLD_PROGRESS_SEGMENTS;
    expect(litAt(first - 1).every((on) => !on)).toBe(true);
  });

  it("resets every segment on an early release, and sends nothing", () => {
    let s: HoldState = onPress(IDLE, 0);
    s = onTick(s, SEAL_HOLD_MS * 0.5);
    expect(holdSegmentsLit(s).some(Boolean)).toBe(true);
    s = onRelease(s, SEAL_HOLD_MS * 0.5);
    expect(s.phase).toBe("settling");
    expect(holdSegmentsLit(s).every((on) => !on)).toBe(true);
    // The settle runs back to idle; no break is ever reported.
    const settled = onTick(s, SEAL_HOLD_MS * 0.5 + SEAL_SETTLE_MS + 1);
    expect(settled.phase).toBe("idle");
    expect(isBreak(s, settled)).toBe(false);
  });

  it("lights every segment when the seal breaks, and the break is reported once", () => {
    let s: HoldState = onPress(IDLE, 0);
    let breaks = 0;
    // A fake clock stepping every 16 ms past the end of the hold.
    for (let t = 16; t <= SEAL_HOLD_MS + 160; t += 16) {
      const next = onTick(s, t);
      if (isBreak(s, next)) breaks += 1;
      s = next;
    }
    expect(s.phase).toBe("broken");
    expect(holdSegmentsLit(s).every(Boolean)).toBe(true);
    // One ADVANCE at the end: the break transition fires exactly once.
    expect(breaks).toBe(1);
  });

  it("a release exactly at the threshold breaks the seal, once", () => {
    const held = onTick(onPress(IDLE, 0), SEAL_HOLD_MS);
    expect(held.phase).toBe("broken");
    const released = onRelease(held, SEAL_HOLD_MS + 5);
    expect(released.phase).toBe("broken");
    expect(isBreak(held, released)).toBe(false);
  });
});
