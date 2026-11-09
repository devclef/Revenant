// Tests for the seed effect in useOpeningFlow (spec 10 C5.4, C5.6).
//
// The repo has no DOM test environment, so React's hooks are replaced by the
// same small stand-in used in figures-api.hook.test.ts. One "render" resets the
// hook slots and collects the effects in declaration order; the test then runs
// them in that order, as React does after commit.

import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as Array<{ value: unknown }>,
  index: 0,
  effects: [] as Array<() => void>,
  order: [] as string[],
}));

vi.mock("react", () => {
  const take = (initial: unknown): { value: unknown } => {
    const slot = harness.slots[harness.index] ?? { value: initial };
    harness.slots[harness.index] = slot;
    harness.index += 1;
    return slot;
  };
  return {
    useReducer: (_reducer: unknown, initial: unknown) => [
      take(initial).value,
      () => undefined,
    ],
    useState: (initial: unknown) => [take(initial).value, () => undefined],
    useRef: (initial: unknown) => take({ current: initial }).value,
    useCallback: (fn: unknown) => fn,
    useEffect: (effect: () => void) => {
      harness.effects.push(effect);
    },
  };
});

vi.mock("./sample-seed", () => ({ drawSampleSeed: vi.fn() }));

vi.mock("./api", () => ({
  // Never resolves, so the loading effect starts and then waits.
  getLetter: vi.fn(() => {
    harness.order.push("letter");
    return new Promise(() => undefined);
  }),
  getSecret: vi.fn(),
  postOpening: vi.fn(),
}));

vi.mock("@/components/live/unlock", () => ({
  noticeForAssertFailure: vi.fn(),
  readBackupKeyField: vi.fn(),
  readUnlockEnvelope: vi.fn(),
  startPasskeyAssertion: vi.fn(),
}));

import { drawSampleSeed } from "./sample-seed";
import { getLetter } from "./api";
import { useOpeningFlow } from "./useOpeningFlow";

const drawMock = vi.mocked(drawSampleSeed);
const letterMock = vi.mocked(getLetter);

/** One render: reset the slots and collect the effects, without running them. */
function useRender(): void {
  harness.index = 0;
  harness.effects = [];
  useOpeningFlow("letter-1");
}

/** Run the collected effects in declaration order, as React does after commit. */
function runEffects(): void {
  for (const effect of harness.effects) {
    effect();
  }
}

beforeEach(() => {
  harness.slots = [];
  harness.index = 0;
  harness.effects = [];
  harness.order = [];
  drawMock.mockReset();
  letterMock.mockClear();
});

describe("useOpeningFlow seed effect (spec 10 C5.4, C5.6)", () => {
  it("draws the seed in a mount effect, never in render, before the loading effect", () => {
    drawMock.mockImplementation(() => {
      harness.order.push("seed");
      return 7;
    });

    useRender();
    expect(drawMock).not.toHaveBeenCalled();

    runEffects();
    expect(harness.order).toEqual(["seed", "letter"]);
    expect(drawMock).toHaveBeenCalledTimes(1);
  });

  it("draws once per mount, even when the effects run again (strict mode)", () => {
    drawMock.mockReturnValue(7);

    useRender();
    runEffects();
    runEffects();

    expect(drawMock).toHaveBeenCalledTimes(1);
    expect(letterMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the flow running when the seed cannot be drawn", () => {
    drawMock.mockImplementation(() => {
      throw new Error("Web Crypto getRandomValues is not available");
    });

    useRender();
    expect(() => runEffects()).not.toThrow();
    expect(drawMock).toHaveBeenCalledTimes(1);
    expect(letterMock).toHaveBeenCalledTimes(1);
  });
});
