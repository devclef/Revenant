// Feature: 09-demo-polish, P9 (keyboard) and 16-remember-first, requirement 1:
// the useKeepInVisualViewport hook. The node test environment has no DOM and no
// React renderer for effects, so useEffect runs its callback at once and the
// window, the visual viewport, the document and the group element are stubbed.
// The pure rules have their own tests in use-keep-in-visual-viewport.test.ts.

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

type Element = {
  tagName: string;
  type?: string;
  getAttribute: (name: string) => string | null;
  getBoundingClientRect: () => { top: number; bottom: number };
};

function element(tagName: string, type?: string, role: string | null = null, top = 510, bottom = 530): Element {
  return {
    tagName,
    type,
    getAttribute: (name: string) => (name === "role" ? role : null),
    getBoundingClientRect: () => ({ top, bottom }),
  };
}

type Stubs = {
  group: ReturnType<typeof listenerTarget> & {
    getBoundingClientRect: () => { top: number; bottom: number };
    contains: (node: unknown) => boolean;
  };
  viewport: ReturnType<typeof listenerTarget> & { offsetTop: number; height: number; scale: number };
  win: ReturnType<typeof listenerTarget> & {
    visualViewport: unknown;
    innerHeight: number;
    scrollBy: ReturnType<typeof vi.fn>;
  };
  doc: { activeElement: unknown };
  scrollBy: ReturnType<typeof vi.fn>;
};

/**
 * The group sits at 500 to 540 px. The visual viewport is 300 px tall in a
 * 600 px layout viewport, so the keyboard is open. The band is 56 to 292.
 */
function stubBrowser(): Stubs {
  const group = {
    ...listenerTarget(),
    getBoundingClientRect: () => ({ top: 500, bottom: 540 }),
    contains: (node: unknown) => node !== null && node !== undefined,
  };
  const viewport = { ...listenerTarget(), offsetTop: 0, height: 300, scale: 1 };
  const scrollBy = vi.fn();
  const win = { ...listenerTarget(), visualViewport: viewport, innerHeight: 600, scrollBy };
  const doc = { activeElement: null as unknown };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  return { group, viewport, win, doc, scrollBy };
}

let stubs: Stubs;

beforeEach(() => {
  stubs = stubBrowser();
  hook.cleanup = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function useKeepGroup(calm: boolean) {
  useKeepInVisualViewport({ current: stubs.group as never }, calm);
}

describe("useKeepInVisualViewport (P9, requirement 1)", () => {
  it("attaches focusin to the group and resize and scroll to the visual viewport", () => {
    useKeepGroup(false);
    expect(stubs.group.count("focusin")).toBe(1);
    expect(stubs.viewport.count("resize")).toBe(1);
    expect(stubs.viewport.count("scroll")).toBe(1);
  });

  it("attaches resize and scroll to the window when there is no visual viewport", () => {
    stubs.win.visualViewport = undefined;
    useKeepGroup(false);
    expect(stubs.group.count("focusin")).toBe(1);
    expect(stubs.win.count("resize")).toBe(1);
    expect(stubs.win.count("scroll")).toBe(1);
    expect(stubs.viewport.addEventListener).not.toHaveBeenCalled();
  });

  // Band: 0 + 56 top, 300 - 8 bottom = 292. Group bottom 540 minus 292 = 248.
  it("scrolls the Text_Field's group into view on focus, smoothly when not Calm", () => {
    useKeepGroup(false);
    stubs.doc.activeElement = element("INPUT", "text");
    stubs.group.fire("focusin");
    expect(stubs.scrollBy).toHaveBeenCalledWith({ top: 248, behavior: "smooth" });
  });

  it("scrolls instantly on focus under Calm", () => {
    useKeepGroup(true);
    stubs.doc.activeElement = element("TEXTAREA");
    stubs.group.fire("focusin");
    expect(stubs.scrollBy).toHaveBeenCalledWith({ top: 248, behavior: "auto" });
  });

  // Case 2: a button, checkbox or radio gains focus while the keyboard is open.
  it("makes no scroll call on focus of a button, checkbox or radio while Keyboard_Open", () => {
    useKeepGroup(false);
    for (const focused of [
      element("BUTTON"),
      element("INPUT", "checkbox"),
      element("INPUT", "radio"),
    ]) {
      stubs.doc.activeElement = focused;
      stubs.group.fire("focusin");
    }
    expect(stubs.scrollBy).not.toHaveBeenCalled();
  });

  // Case 3: a button inside the group holds focus when the visual viewport resizes.
  it("makes no scroll call on a viewport resize while a button inside the group holds focus", () => {
    useKeepGroup(false);
    stubs.doc.activeElement = element("BUTTON");
    stubs.viewport.fire("resize");
    expect(stubs.scrollBy).not.toHaveBeenCalled();
  });

  it("re-keeps the Text_Field on a viewport resize while it holds focus", () => {
    useKeepGroup(false);
    stubs.doc.activeElement = element("INPUT", "text");
    stubs.viewport.fire("resize");
    expect(stubs.scrollBy).toHaveBeenCalledTimes(1);
    expect(stubs.scrollBy).toHaveBeenCalledWith({ top: 248, behavior: "smooth" });
  });

  it("re-keeps the Text_Field on a visual viewport scroll while it holds focus", () => {
    useKeepGroup(true);
    stubs.doc.activeElement = element("INPUT", "email");
    stubs.viewport.fire("scroll");
    expect(stubs.scrollBy).toHaveBeenCalledWith({ top: 248, behavior: "auto" });
  });

  it("does nothing on a viewport resize while focus is outside the group", () => {
    useKeepGroup(false);
    stubs.group.contains = () => false;
    stubs.doc.activeElement = element("INPUT", "text");
    stubs.viewport.fire("resize");
    expect(stubs.scrollBy).not.toHaveBeenCalled();
  });

  // Case 1: Keyboard_Open is false, so no scroll call.
  it("makes no scroll call while Keyboard_Open is false", () => {
    stubs.viewport.height = 600;
    useKeepGroup(false);
    stubs.doc.activeElement = element("INPUT", "text");
    stubs.group.fire("focusin");
    expect(stubs.scrollBy).not.toHaveBeenCalled();
  });

  it("removes every listener it attached when the effect cleans up", () => {
    useKeepGroup(false);
    hook.cleanup?.();
    expect(stubs.group.count("focusin")).toBe(0);
    expect(stubs.viewport.count("resize")).toBe(0);
    expect(stubs.viewport.count("scroll")).toBe(0);
  });

  it("attaches nothing when the ref has no element yet", () => {
    useKeepInVisualViewport({ current: null }, false);
    expect(stubs.group.addEventListener).not.toHaveBeenCalled();
    expect(stubs.viewport.addEventListener).not.toHaveBeenCalled();
    expect(hook.cleanup).toBeUndefined();
  });
});
