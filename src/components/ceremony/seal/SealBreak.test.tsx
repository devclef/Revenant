// Feature: 05-reveal-ceremony
//
// Markup and handler tests for SealBreak (design.md "Seal_Break"; Property 2's
// seal clauses, Property 19's seal clause, Property 5, Property 21). The default
// Vitest environment is node, so there is no DOM to fire events. Instead:
//
//   - The settled markup is rendered with `renderToStaticMarkup` (Property 2).
//   - The event clauses call the handler props straight off the element tree
//     SealBreak returns. A small hook harness stands in for React's hooks while
//     `harness.active` is set, so the component's state, refs and effects run
//     for real. Frames and the clock are stubbed, so time is explicit.
//
// The hook harness only replaces `useState`, `useRef`, `useCallback` and
// `useEffect` for these event tests. Outside the harness they delegate to
// React, so the static markup tests still use React's own renderer.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEAL_HOLD_MS } from "../constants";
import { CEREMONY_COPY } from "../copy";
import { LiveRegionProvider } from "../LiveRegion";
import { MotionProvider } from "../motion";
import { SkipProvider } from "../skip";
import { SealBreak, type SealBreakProps } from "./SealBreak";
import { TOTAL_LENGTH, CRACK_COUNT } from "./cracks";

// The three context hooks SealBreak reads. They are stubbed so the event tests
// need no providers; the spies let each test read what was announced, sent and
// registered. The provider exports are kept (importOriginal) for the markup tests.
const spies = vi.hoisted(() => ({
  announce: vi.fn(),
  register: vi.fn(() => () => undefined),
  onSealing: vi.fn(),
}));

vi.mock("../LiveRegion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../LiveRegion")>()),
  useLiveRegion: () => ({ announce: spies.announce }),
}));

vi.mock("../skip", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../skip")>()),
  useSequence: () => ({ hasActive: false, register: spies.register, skipAll: () => undefined }),
}));

vi.mock("../motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../motion")>()),
  useMotion: () => ({ mode: "full" }),
}));

// The hook harness. While `active`, the mocked React hooks below use these
// slots, so SealBreak's state, refs and effects behave as they do in React.
// `commit` re-runs the component, mirroring a re-render after a state change.
const harness = vi.hoisted(() => ({
  active: false,
  slots: [] as Array<Record<string, unknown>>,
  cursor: 0,
  effects: [] as Array<() => void>,
  component: null as null | ((props: unknown) => unknown),
  props: null as unknown,
  tree: null as unknown,
  commit: (): void => {
    harness.cursor = 0;
    harness.effects = [];
    harness.tree = harness.component?.(harness.props);
    const pending = harness.effects;
    for (const effect of pending) effect();
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const slot = <T extends Record<string, unknown>>(create: () => T): T => {
    if (harness.cursor >= harness.slots.length) harness.slots.push(create());
    const current = harness.slots[harness.cursor];
    harness.cursor += 1;
    return current as T;
  };
  return {
    ...actual,
    useState: <S,>(initial: S | (() => S)) => {
      if (!harness.active) return actual.useState(initial);
      const cell = slot(() => {
        const c: Record<string, unknown> = {
          value: typeof initial === "function" ? (initial as () => S)() : initial,
        };
        c.set = (next: unknown) => {
          c.value =
            typeof next === "function"
              ? (next as (prev: unknown) => unknown)(c.value)
              : next;
          harness.commit();
        };
        return c;
      });
      return [cell.value as S, cell.set as (next: S | ((p: S) => S)) => void];
    },
    useRef: <T,>(initial: T) => {
      if (!harness.active) return actual.useRef(initial);
      return slot(() => ({ current: initial })) as { current: T };
    },
    useCallback: <F,>(fn: F, deps: unknown[]) => {
      if (!harness.active) return actual.useCallback(fn as never, deps);
      return fn;
    },
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
      if (!harness.active) return actual.useEffect(effect, deps);
      harness.effects.push(() => {
        effect();
      });
    },
  };
});

const SOURCE_PATH = new URL("./SealBreak.tsx", import.meta.url);

const renderSealBreak = (overrides: Partial<SealBreakProps> = {}): string =>
  renderToStaticMarkup(
    createElement(
      SkipProvider,
      null,
      createElement(
        LiveRegionProvider,
        null,
        createElement(
          MotionProvider,
          null,
          createElement(SealBreak, {
            patternKey: "us-maya",
            onAdvance: () => undefined,
            ...overrides,
          }),
        ),
      ),
    ),
  );

/** Every crack path's `stroke-dashoffset` as it appears in the markup. */
const crackDashoffsets = (markup: string): string[] =>
  Array.from(markup.matchAll(/<path[^>]*stroke-dashoffset="([^"]+)"/g)).map(
    (m) => m[1],
  );

describe("SealBreak settled render shows the unbroken seal (Property 2, seal clauses)", () => {
  it("is not broken: data-broken is false and no split, flap or letter is drawn", () => {
    const markup = renderSealBreak();
    expect(markup).toContain('data-broken="false"');
    expect(markup).not.toContain('data-broken="true"');
    // Flakes carry their fall vector as inline custom properties; none appear
    // before the seal breaks.
    expect(markup).not.toContain("--flake-x");
    expect(markup).not.toContain("--flake-dx");
  });

  it("draws no crack: all nine paths are hidden at the full dash offset", () => {
    const offsets = crackDashoffsets(renderSealBreak());
    expect(offsets).toHaveLength(CRACK_COUNT);
    for (const offset of offsets) {
      expect(Number(offset)).toBe(TOTAL_LENGTH);
    }
  });

  it("renders the same markup on every render (server and first client render agree)", () => {
    const first = renderSealBreak();
    expect(renderSealBreak()).toBe(first);
    expect(renderSealBreak()).toBe(first);
  });
});

describe("SealBreak seal clause of Property 19: the pointer target has a real button in the same Stage", () => {
  // Feature: 05-reveal-ceremony, Property 19: the seal is the pointer target
  // but the accessible control is a real button that sends the same ADVANCE.
  it("hides the pointer target from assistive tech and keeps it out of the tab order", () => {
    const markup = renderSealBreak();
    const target = markup.match(/<span[^>]*aria-hidden="true"[^>]*>/);
    expect(target).not.toBeNull();
    expect(target?.[0]).not.toMatch(/tabindex/i);
    expect(target?.[0]).not.toMatch(/role="button"/);
  });

  it("renders a real <button type=\"button\"> carrying the Break the seal label", () => {
    const markup = renderSealBreak();
    expect(markup).toMatch(
      new RegExp(
        `<button[^>]*type="button"[^>]*>${CEREMONY_COPY.sealButton}</button>`,
      ),
    );
  });

  it("shows the instruction line in the same Stage as the button", () => {
    const markup = renderSealBreak();
    expect(markup).toContain(
      CEREMONY_COPY.sealInstruction.replace(/'/g, "&#x27;"),
    );
  });
});

describe("SealBreak source (Property 21)", () => {
  // Comments are blanked before matching, so the doc comments that name these
  // calls do not count. String literals are blanked too, so only real calls
  // match.
  const code = readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, "``");

  it("calls no Math.random and no Date.now", () => {
    expect(code).not.toMatch(/\bMath\s*\.\s*random\b/);
    expect(code).not.toMatch(/\bDate\s*\.\s*now\b/);
  });

  it("imports no @/lib/crypto statically", () => {
    // The specifier is composed from fragments so this test file itself does
    // not contain a literal static crypto import (see source-scan.test.ts).
    const cryptoPrefix = ["@", "lib", "crypto"].join("/");
    const staticImport = new RegExp(
      `(?:from|import)\\s*["']${cryptoPrefix}(?:/[^"']*)?["']`,
    );
    expect(staticImport.test(readFileSync(SOURCE_PATH, "utf8"))).toBe(false);
  });
});

// --- Event-driven clauses (Property 19 gesture, Property 5, R6.5) ---

/** Find the first element in a returned tree that satisfies `pred`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findElement(node: any, pred: (el: any) => boolean): any {
  if (node === null || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, pred);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (pred(node)) return node;
  return findElement(node.props?.children, pred);
}

// The seal's pointer target: the span that carries onPointerDown.
const sealTarget = (tree: unknown) =>
  findElement(tree, (el) => typeof el.props?.onPointerDown === "function");

// The accessible button: the first <button> with an onClick (no Show-everything
// button is rendered without onShowAll).
const breakButton = (tree: unknown) =>
  findElement(tree, (el) => el.type === "button" && typeof el.props?.onClick === "function");

/** A pointer event whose capture call either succeeds or throws. */
const pressEvent = (captureThrows: boolean) => ({
  pointerId: 1,
  currentTarget: {
    setPointerCapture: () => {
      if (captureThrows) throw new Error("InvalidPointerId");
    },
    releasePointerCapture: () => undefined,
  },
});

// Stubbed clock and frames. `runFrames` advances time in 16 ms steps and runs
// the rAF callbacks queued before each step, like a browser would.
let clock = 0;
let frames = new Map<number, (t: number) => void>();
let nextFrameId = 1;
let windowListeners = new Map<string, () => void>();

const runFrames = (totalMs: number): void => {
  for (let elapsed = 0; elapsed < totalMs; elapsed += 16) {
    clock += 16;
    const pending = [...frames.values()];
    frames.clear();
    for (const cb of pending) cb(clock);
  }
};

/** Mount SealBreak through the harness and return a reader for its latest tree. */
const mount = (onAdvance: () => void) => {
  harness.slots = [];
  harness.component = SealBreak as unknown as (props: unknown) => unknown;
  harness.props = { patternKey: "us-maya", onAdvance, onSealingChange: spies.onSealing };
  harness.active = true;
  harness.commit();
  return { tree: () => harness.tree };
};

describe("SealBreak button path sends ADVANCE exactly once (Property 19, Property 5)", () => {
  beforeEach(() => {
    clock = 0;
    frames = new Map();
    nextFrameId = 1;
    windowListeners = new Map();
    vi.stubGlobal("performance", { now: () => clock });
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
      const id = nextFrameId++;
      frames.set(id, cb);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frames.delete(id);
    });
    vi.stubGlobal("window", {
      addEventListener: (type: string, fn: () => void) => windowListeners.set(type, fn),
      removeEventListener: (type: string) => windowListeners.delete(type),
    });
    spies.announce.mockClear();
    spies.onSealing.mockClear();
  });

  afterEach(() => {
    harness.active = false;
    harness.slots = [];
    vi.unstubAllGlobals();
  });

  it("the Break the seal button calls onAdvance once, and a second click does not send it again", () => {
    const onAdvance = vi.fn();
    const view = mount(onAdvance);

    breakButton(view.tree()).props.onClick();
    expect(onAdvance).toHaveBeenCalledTimes(1);

    breakButton(view.tree()).props.onClick();
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("a press that loses pointer capture still holds, and breaks the seal after SEAL_HOLD_MS", () => {
    const onAdvance = vi.fn();
    const view = mount(onAdvance);

    // setPointerCapture throws (an invalid pointer id). The press must not throw
    // and the hold must keep running on the window listeners.
    expect(() => sealTarget(view.tree()).props.onPointerDown(pressEvent(true))).not.toThrow();
    expect(windowListeners.has("pointerup")).toBe(true);

    runFrames(SEAL_HOLD_MS / 2);
    expect(onAdvance).not.toHaveBeenCalled();

    runFrames(SEAL_HOLD_MS);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});

describe("the seal instruction uses the paper ink (the seal sits in StagePanel's paper panel)", () => {
  it("sets the instruction line to the ink, not the desk ink", () => {
    const css = readFileSync(join(__dirname, "SealBreak.module.css"), "utf8");
    expect(css).toMatch(/\.instruction\s*\{[^}]*color:\s*var\(--ink\)/);
    expect(css).not.toMatch(/\.instruction\s*\{[^}]*color:\s*var\(--desk-ink/);
  });
});
