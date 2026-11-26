// Tests for useOwnScroll (own-scroll.ts). The repo has no DOM test
// environment, so React's useState and useEffect are replaced by a small
// stand-in. A "mount" resets the state slot and runs the effects once, as the
// browser does after the first render.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Slot = { value: unknown };

const harness = vi.hoisted(() => ({
  slot: null as Slot | null,
  effects: [] as Array<() => void | (() => void)>,
  cleanups: [] as Array<() => void>,
}));

vi.mock("react", () => ({
  useState: (initial: unknown) => {
    if (harness.slot === null) harness.slot = { value: initial };
    const slot = harness.slot;
    const setState = (next: unknown) => {
      slot.value = next;
    };
    return [slot.value, setState];
  },
  useEffect: (effect: () => void | (() => void)) => {
    harness.effects.push(effect);
  },
}));

import { useOwnScroll } from "./own-scroll";

type Observer = { callback: () => void; observed: unknown[]; disconnected: boolean };

const observers: Observer[] = [];

class FakeResizeObserver {
  private readonly record: Observer;
  constructor(callback: () => void) {
    this.record = { callback, observed: [], disconnected: false };
    observers.push(this.record);
  }
  observe(target: unknown) {
    this.record.observed.push(target);
  }
  disconnect() {
    this.record.disconnected = true;
  }
}

function element(scrollHeight: number, clientHeight: number) {
  return { scrollHeight, clientHeight } as unknown as HTMLElement;
}

/** Mount: reset the state, render with the given inputs, then run the effects. */
function useMounted(ref: { current: HTMLElement | null }, enabled: boolean) {
  harness.slot = null;
  harness.effects = [];
  harness.cleanups = [];
  const first = useOwnScroll(ref, enabled);
  for (const effect of harness.effects) {
    const cleanup = effect();
    if (typeof cleanup === "function") harness.cleanups.push(cleanup);
  }
  return first;
}

/** Re-render with the state from the last mount. The effects are not run again. */
function useRerendered(ref: { current: HTMLElement | null }, enabled: boolean) {
  harness.effects = [];
  return useOwnScroll(ref, enabled);
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useOwnScroll", () => {
  it("returns false on the first render, before any measurement", () => {
    const ref = { current: element(900, 400) };
    harness.slot = null;
    harness.effects = [];
    expect(useOwnScroll(ref, true)).toBe(false);
  });

  it("reports overflow when the content is taller than the box", () => {
    const ref = { current: element(900, 400) };
    useMounted(ref, true);
    expect(useRerendered(ref, true)).toBe(true);
  });

  it("reports no overflow when the content fits", () => {
    const ref = { current: element(400, 400) };
    useMounted(ref, true);
    expect(useRerendered(ref, true)).toBe(false);
  });

  it("observes the element while enabled", () => {
    const target = element(900, 400);
    useMounted({ current: target }, true);
    expect(observers).toHaveLength(1);
    expect(observers[0].observed).toEqual([target]);
  });

  it("measures again when the observer fires after a resize", () => {
    const target = element(900, 400);
    const ref = { current: target };
    useMounted(ref, true);
    expect(useRerendered(ref, true)).toBe(true);
    (target as unknown as { scrollHeight: number }).scrollHeight = 400;
    observers[0].callback();
    expect(useRerendered(ref, true)).toBe(false);
  });

  it("disconnects the observer on cleanup", () => {
    useMounted({ current: element(900, 400) }, true);
    for (const cleanup of harness.cleanups) cleanup();
    expect(observers[0].disconnected).toBe(true);
  });

  it("stays false and observes nothing while disabled", () => {
    const ref = { current: element(900, 400) };
    useMounted(ref, false);
    expect(useRerendered(ref, false)).toBe(false);
    expect(observers).toHaveLength(0);
  });

  it("returns false when ResizeObserver is missing", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const ref = { current: element(900, 400) };
    expect(() => useMounted(ref, true)).not.toThrow();
    expect(useRerendered(ref, true)).toBe(false);
  });

  it("returns false when the ref has no element yet", () => {
    const ref = { current: null as HTMLElement | null };
    useMounted(ref, true);
    expect(useRerendered(ref, true)).toBe(false);
    expect(observers).toHaveLength(0);
  });
});
