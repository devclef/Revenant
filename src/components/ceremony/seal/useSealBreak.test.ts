// Feature: 07-judge-journey (task 5)
//
// Unit tests for useSealBreak. The default Vitest environment is node, so the
// hook runs through a small harness: while `harness.active` is set, the mocked
// React hooks below use stored slots, so the hook's state, refs and effects run
// for real. Frames, timers, the clock and the window listeners are stubbed, so
// time is explicit.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEAL_HOLD_MS, SEAL_SHORT_MS } from "../constants";
import { CEREMONY_COPY } from "../copy";
import { useSealBreak, type SealController, type SealHost } from "./useSealBreak";

const spies = vi.hoisted(() => ({
  sealBreak: vi.fn(async () => undefined),
}));

vi.mock("../sound/cues", () => ({
  soundCues: { sealBreak: spies.sealBreak },
}));

const harness = vi.hoisted(() => ({
  active: false,
  slots: [] as Array<Record<string, unknown>>,
  cursor: 0,
  effects: [] as Array<() => void>,
  tree: null as unknown,
  run: null as null | (() => unknown),
  commit: (): void => {
    harness.cursor = 0;
    harness.effects = [];
    harness.tree = harness.run?.();
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

// --- Stubbed clock, frames, timers and window ---

let clock = 0;
let frames = new Map<number, (t: number) => void>();
let nextFrameId = 1;
let windowListeners = new Map<string, () => void>();
let timers = new Map<number, { fn: () => void; at: number }>();
let nextTimerId = 1;

/** Run rAF callbacks in 16 ms steps for `totalMs`, like a browser. */
const runFrames = (totalMs: number): void => {
  for (let elapsed = 0; elapsed < totalMs; elapsed += 16) {
    clock += 16;
    const pending = [...frames.values()];
    frames.clear();
    for (const cb of pending) cb(clock);
  }
};

/** Advance the stubbed timers by `ms`, firing any that come due. */
const runTimers = (ms: number): void => {
  clock += ms;
  for (const [id, timer] of [...timers.entries()]) {
    if (timer.at <= clock) {
      timers.delete(id);
      timer.fn();
    }
  }
};

const pointerTarget = () =>
  ({
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  }) as unknown as Element;

const throwingTarget = () =>
  ({
    setPointerCapture: () => {
      throw new Error("InvalidPointerId");
    },
    releasePointerCapture: () => undefined,
  }) as unknown as Element;

type Mounted = { ctl: () => SealController; host: SealHost & { onSealingChange: ReturnType<typeof vi.fn> } ; onAdvance: ReturnType<typeof vi.fn>; onShowAll: ReturnType<typeof vi.fn>; announce: ReturnType<typeof vi.fn> };

/** Mount the hook through the harness and connect a host with spies. */
const mount = (opts: { calm?: boolean; soundOn?: boolean } = {}): Mounted => {
  harness.slots = [];
  const onAdvance = vi.fn();
  const onShowAll = vi.fn();
  const announce = vi.fn();
  const onSealingChange = vi.fn();
  const Host = () => useSealBreak({ onAdvance, onShowAll });
  harness.run = Host;
  harness.active = true;
  harness.commit();
  const ctl = () => harness.tree as SealController;
  ctl().connect({
    announce,
    calm: opts.calm ?? false,
    soundOn: opts.soundOn ?? false,
    onSealingChange,
  });
  return {
    ctl,
    host: { announce, calm: opts.calm ?? false, soundOn: opts.soundOn ?? false, onSealingChange },
    onAdvance,
    onShowAll,
    announce,
  };
};

beforeEach(() => {
  clock = 0;
  frames = new Map();
  nextFrameId = 1;
  windowListeners = new Map();
  timers = new Map();
  nextTimerId = 1;
  vi.stubGlobal("performance", { now: () => clock });
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
    const id = nextFrameId++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
  vi.stubGlobal("setTimeout", (fn: () => void, ms: number) => {
    const id = nextTimerId++;
    timers.set(id, { fn, at: clock + ms });
    return id;
  });
  vi.stubGlobal("clearTimeout", (id: number) => {
    timers.delete(id);
  });
  vi.stubGlobal("window", {
    addEventListener: (type: string, fn: () => void) => windowListeners.set(type, fn),
    removeEventListener: (type: string) => windowListeners.delete(type),
  });
  spies.sealBreak.mockClear();
});

afterEach(() => {
  harness.active = false;
  harness.slots = [];
  vi.unstubAllGlobals();
});

describe("useSealBreak: pointer hold (R6.2, R6.4, R6.5)", () => {
  it("holding for SEAL_HOLD_MS breaks the seal and sends ADVANCE once", () => {
    const m = mount();
    m.ctl().press(pointerTarget(), 1);
    runFrames(SEAL_HOLD_MS / 2);
    expect(m.onAdvance).not.toHaveBeenCalled();
    expect(m.ctl().progress).toBeGreaterThan(0);

    runFrames(SEAL_HOLD_MS);
    expect(m.ctl().broken).toBe(true);
    expect(m.ctl().progress).toBe(1);
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
    expect(m.announce).toHaveBeenCalledWith(CEREMONY_COPY.sealBroken);
  });

  it("a second press after the break sends nothing", () => {
    const m = mount();
    m.ctl().press(pointerTarget(), 1);
    runFrames(SEAL_HOLD_MS);
    m.ctl().press(pointerTarget(), 2);
    runFrames(SEAL_HOLD_MS);
    m.ctl().breakNow(null);
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
  });

  it("an early release settles back to idle, announces the hold and sends nothing", () => {
    const m = mount();
    m.ctl().press(pointerTarget(), 1);
    runFrames(SEAL_HOLD_MS / 2);
    windowListeners.get("pointerup")?.();
    expect(m.ctl().hold.phase).toBe("settling");
    expect(m.announce).toHaveBeenCalledWith(CEREMONY_COPY.sealHolds);

    runFrames(10_000);
    expect(m.ctl().hold.phase).toBe("idle");
    expect(m.ctl().broken).toBe(false);
    expect(m.onAdvance).not.toHaveBeenCalled();
    expect(m.host.onSealingChange).toHaveBeenLastCalledWith(false);
  });

  it("a release that lands at full progress breaks the seal", () => {
    const m = mount();
    m.ctl().press(pointerTarget(), 1);
    clock += SEAL_HOLD_MS;
    windowListeners.get("pointerup")?.();
    expect(m.ctl().broken).toBe(true);
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
  });

  it("a press whose pointer capture throws still holds, on the window listeners", () => {
    const m = mount();
    expect(() => m.ctl().press(throwingTarget(), 1)).not.toThrow();
    expect(windowListeners.has("pointerup")).toBe(true);
    expect(windowListeners.has("pointercancel")).toBe(true);
    runFrames(SEAL_HOLD_MS);
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
  });

  it("reports the sealing flag: true on press", () => {
    const m = mount();
    m.ctl().press(pointerTarget(), 1);
    expect(m.host.onSealingChange).toHaveBeenCalledWith(true);
  });
});

describe("useSealBreak: the button path (R6.3)", () => {
  it("in full motion plays the short draw over SEAL_SHORT_MS, with sealing true, then sends ADVANCE once", () => {
    const m = mount();
    m.ctl().breakNow(null);
    expect(m.host.onSealingChange).toHaveBeenLastCalledWith(true);
    expect(m.onAdvance).not.toHaveBeenCalled();

    runTimers(SEAL_SHORT_MS - 1);
    expect(m.onAdvance).not.toHaveBeenCalled();
    runTimers(1);
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
    expect(m.ctl().broken).toBe(true);

    m.ctl().breakNow(null);
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
  });

  it("in Calm_Mode sends ADVANCE at once with no short draw", () => {
    const m = mount({ calm: true });
    m.ctl().breakNow(null);
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
    expect(m.ctl().broken).toBe(true);
    expect(timers.size).toBe(0);
  });

  it("in Calm_Mode a press starts no hold and draws no cracks; the button still breaks at once", () => {
    const m = mount({ calm: true });
    m.ctl().press(pointerTarget(), 1);
    expect(m.host.onSealingChange).not.toHaveBeenCalledWith(true);
    runFrames(SEAL_HOLD_MS);
    expect(m.onAdvance).not.toHaveBeenCalled();
    expect(m.ctl().broken).toBe(false);
    expect(m.ctl().progress).toBe(0);
    m.ctl().breakNow(null);
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
  });

  it("runs the short draw on the root's paths with Web Animations, and sends ADVANCE when they finish", async () => {
    const m = mount();
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel }));
    const root = { querySelectorAll: () => [{ animate }, { animate }] } as unknown as Element;
    m.ctl().breakNow(root);
    expect(animate).toHaveBeenCalledTimes(2);
    const firstOptions = (animate.mock.calls as unknown as Array<[unknown, { duration: number }]>)[0][1];
    expect(firstOptions).toMatchObject({ duration: SEAL_SHORT_MS });

    await Promise.resolve();
    await Promise.resolve();
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
  });

  it("if a Web Animation throws, sends ADVANCE once at once", () => {
    const m = mount();
    const root = {
      querySelectorAll: () => [{ animate: () => {
        throw new Error("boom");
      } }],
    } as unknown as Element;
    expect(() => m.ctl().breakNow(root)).not.toThrow();
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
    expect(m.ctl().broken).toBe(true);
  });

  it("if Web Animations are missing, sends ADVANCE once at once", () => {
    const m = mount();
    const root = { querySelectorAll: () => [{}] } as unknown as Element;
    m.ctl().breakNow(root);
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
  });
});

describe("useSealBreak: Skip and Show everything", () => {
  it("skip sends ADVANCE once when the seal has not broken", () => {
    const m = mount();
    m.ctl().skip();
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
    expect(m.ctl().broken).toBe(true);
    m.ctl().skip();
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
  });

  it("skip during a short draw does not send ADVANCE a second time", () => {
    const m = mount();
    m.ctl().breakNow(null);
    m.ctl().skip();
    runTimers(SEAL_SHORT_MS);
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
  });

  it("show everything breaks the seal and sends SHOW_ALL, not ADVANCE", () => {
    const m = mount();
    m.ctl().showAll();
    expect(m.ctl().broken).toBe(true);
    expect(m.onShowAll).toHaveBeenCalledTimes(1);
    expect(m.onAdvance).not.toHaveBeenCalled();
  });
});

describe("useSealBreak: the sound cue (R14.2)", () => {
  it("plays the break cue with the sound flag the host gives", () => {
    const m = mount({ soundOn: true });
    m.ctl().press(pointerTarget(), 1);
    runFrames(SEAL_HOLD_MS);
    expect(spies.sealBreak).toHaveBeenCalledTimes(1);
    expect(spies.sealBreak).toHaveBeenCalledWith(true);
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
  });
});

describe("useSealBreak: the animated flag for the Ghost's leave (R12.6, R12.9, R12.10)", () => {
  it("sends ADVANCE with animated true when a full-motion hold completes", () => {
    const m = mount();
    m.ctl().press(pointerTarget(), 1);
    runFrames(SEAL_HOLD_MS);
    expect(m.onAdvance).toHaveBeenCalledWith(true);
  });

  it("sends ADVANCE with animated false in Calm, so the Ghost unmounts at once", () => {
    const m = mount({ calm: true });
    m.ctl().breakNow(null);
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
    expect(m.onAdvance).toHaveBeenCalledWith(false);
  });

  it("sends ADVANCE with animated false on Skip, which leaves no Ghost", () => {
    const m = mount();
    m.ctl().press(pointerTarget(), 1);
    runFrames(SEAL_HOLD_MS / 2);
    m.ctl().skip();
    expect(m.onAdvance).toHaveBeenCalledTimes(1);
    expect(m.onAdvance).toHaveBeenCalledWith(false);
  });

  it("sends no ADVANCE on Show everything, which sends SHOW_ALL only", () => {
    const m = mount();
    m.ctl().showAll();
    expect(m.onAdvance).not.toHaveBeenCalled();
    expect(m.onShowAll).toHaveBeenCalledTimes(1);
  });
});
