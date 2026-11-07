// Feature: 09-demo-polish, P9 (keyboard): the useKeepInVisualViewport hook.
// The node test environment has no DOM and no React renderer for effects, so
// useEffect runs its callback at once and the window, the visual viewport, the
// document and the group element are stubbed. The pure scroll rules have their
// own tests in use-keep-in-visual-viewport.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hook = vi.hoisted(() => ({
  cleanup: undefined as undefined | (() => void),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      hook.cleanup = effect() ?? undefined;
    },
  };
});

import { useKeepInVisualViewport } from "./use-keep-in-visual-viewport";

type Listener = () => void;

function listenerTarget() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    listeners,
    addEventListener: vi.fn((type: string, fn: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: Listener) => {
      listeners.get(type)?.delete(fn);
    }),
    fire(type: string) {
      for (const fn of listeners.get(type) ?? []) fn();
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

type Stubs = {
  group: ReturnType<typeof listenerTarget> & {
    getBoundingClientRect: () => { top: number; bottom: number };
    contains: (node: unknown) => boolean;
  };
  viewport: ReturnType<typeof listenerTarget> & { offsetTop: number; height: number };
  scrollBy: ReturnType<typeof vi.fn>;
};

/** The group sits at 500 to 540 px; the visual viewport is 300 px tall. */
function stubBrowser(): Stubs {
  const group = {
    ...listenerTarget(),
    getBoundingClientRect: () => ({ top: 500, bottom: 540 }),
    contains: (node: unknown) => node === group,
  };
  const viewport = { ...listenerTarget(), offsetTop: 0, height: 300 };
  const scrollBy = vi.fn();
  const win = { visualViewport: viewport, scrollBy };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", { activeElement: null });
  return { group, viewport, scrollBy };
}

let stubs: Stubs;

beforeEach(() => {
  stubs = stubBrowser();
  hook.cleanup = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useKeepInVisualViewport (P9)", () => {
  it("attaches focusin, resize and scroll listeners to the group and the viewport", () => {
    useKeepInVisualViewport({ current: stubs.group as never }, false);
    expect(stubs.group.count("focusin")).toBe(1);
    expect(stubs.viewport.count("resize")).toBe(1);
    expect(stubs.viewport.count("scroll")).toBe(1);
  });

  // Band: 0 + 56 top, 300 - 8 bottom = 292. Group bottom 540 minus 292 = 248.
  it("scrolls the group into view on focus, smoothly when not Calm", () => {
    useKeepInVisualViewport({ current: stubs.group as never }, false);
    stubs.group.fire("focusin");
    expect(stubs.scrollBy).toHaveBeenCalledWith({ top: 248, behavior: "smooth" });
  });

  it("scrolls instantly on focus under Calm", () => {
    useKeepInVisualViewport({ current: stubs.group as never }, true);
    stubs.group.fire("focusin");
    expect(stubs.scrollBy).toHaveBeenCalledWith({ top: 248, behavior: "auto" });
  });

  it("re-keeps the group on a viewport resize while focus is inside it", () => {
    useKeepInVisualViewport({ current: stubs.group as never }, false);
    vi.stubGlobal("document", { activeElement: stubs.group });
    stubs.viewport.fire("resize");
    expect(stubs.scrollBy).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a viewport resize while focus is outside the group", () => {
    useKeepInVisualViewport({ current: stubs.group as never }, false);
    vi.stubGlobal("document", { activeElement: null });
    stubs.viewport.fire("resize");
    expect(stubs.scrollBy).not.toHaveBeenCalled();
  });

  it("removes every listener it attached when the effect cleans up", () => {
    useKeepInVisualViewport({ current: stubs.group as never }, false);
    hook.cleanup?.();
    expect(stubs.group.count("focusin")).toBe(0);
    expect(stubs.viewport.count("resize")).toBe(0);
    expect(stubs.viewport.count("scroll")).toBe(0);
  });

  it("attaches nothing when the window has no visualViewport", () => {
    vi.stubGlobal("window", { scrollBy: vi.fn() });
    useKeepInVisualViewport({ current: stubs.group as never }, false);
    expect(stubs.group.addEventListener).not.toHaveBeenCalled();
    expect(hook.cleanup).toBeUndefined();
  });

  it("attaches nothing when the ref has no element yet", () => {
    useKeepInVisualViewport({ current: null }, false);
    expect(stubs.group.addEventListener).not.toHaveBeenCalled();
    expect(stubs.viewport.addEventListener).not.toHaveBeenCalled();
  });
});
