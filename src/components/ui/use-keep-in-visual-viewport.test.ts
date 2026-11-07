// Feature: 09-demo-polish, P9 (keyboard): example tests for the visual viewport
// keep. The node test environment has no DOM, so the pure function
// `keepInVisualViewport` is driven with stubbed boxes and a stubbed window.

import { describe, expect, it, vi } from "vitest";

import { keepInVisualViewport, scrollDeltaFor, type BoxedElement } from "./use-keep-in-visual-viewport";

function element(top: number, bottom: number): BoxedElement {
  return { getBoundingClientRect: () => ({ top, bottom }) };
}

describe("a field below the keyboard is scrolled into view (P9)", () => {
  it("scrolls by the amount that puts the bottom of the group above the band, with 'auto' under Calm", () => {
    // Visual viewport 300 px tall at the top: the band is 56 to 292.
    const scrollBy = vi.fn();
    const delta = keepInVisualViewport(
      element(500, 540),
      { visualViewport: { offsetTop: 0, height: 300 }, scrollBy },
      true,
    );
    expect(delta).toBe(540 - 292);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalledWith({ top: 248, behavior: "auto" });
  });

  it("uses smooth scrolling when Calm is off", () => {
    const scrollBy = vi.fn();
    keepInVisualViewport(
      element(500, 540),
      { visualViewport: { offsetTop: 0, height: 300 }, scrollBy },
      false,
    );
    expect(scrollBy).toHaveBeenCalledWith({ top: 248, behavior: "smooth" });
  });

  it("respects a visual viewport that starts lower in the layout viewport", () => {
    // Band: 100 + 56 = 156 to 100 + 300 - 8 = 392.
    const scrollBy = vi.fn();
    const delta = keepInVisualViewport(
      element(380, 420),
      { visualViewport: { offsetTop: 100, height: 300 }, scrollBy },
      true,
    );
    expect(delta).toBe(28);
    expect(scrollBy).toHaveBeenCalledWith({ top: 28, behavior: "auto" });
  });

  it("scrolls up when the group is above the top clear space", () => {
    const scrollBy = vi.fn();
    const delta = keepInVisualViewport(
      element(20, 60),
      { visualViewport: { offsetTop: 0, height: 600 }, scrollBy },
      true,
    );
    expect(delta).toBe(20 - 56);
    expect(scrollBy).toHaveBeenCalledWith({ top: -36, behavior: "auto" });
  });
});

describe("no scroll when the group already fits or there is no visual viewport", () => {
  it("does not scroll a group that is already inside the band", () => {
    const scrollBy = vi.fn();
    const delta = keepInVisualViewport(
      element(100, 140),
      { visualViewport: { offsetTop: 0, height: 600 }, scrollBy },
      true,
    );
    expect(delta).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("does nothing when the window has no visualViewport (no stub, no scroll)", () => {
    const scrollBy = vi.fn();
    const delta = keepInVisualViewport(element(500, 540), { scrollBy }, true);
    expect(delta).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("does nothing when visualViewport is null", () => {
    const scrollBy = vi.fn();
    keepInVisualViewport(element(500, 540), { visualViewport: null, scrollBy }, true);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("does nothing when there is no element", () => {
    const scrollBy = vi.fn();
    const delta = keepInVisualViewport(
      null,
      { visualViewport: { offsetTop: 0, height: 300 }, scrollBy },
      true,
    );
    expect(delta).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
  });
});

describe("scrollDeltaFor", () => {
  it("aligns the top of a group taller than the band", () => {
    expect(scrollDeltaFor({ top: 500, bottom: 900 }, { top: 56, bottom: 292 })).toBe(444);
  });
});
