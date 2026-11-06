// Tests for useFigures (figures-api.ts): one request per reveal.
//
// The repo has no DOM test environment, so React's hooks are replaced by a
// small stand-in for this file. A "mount" resets the hook slots. A "strict
// re-run" keeps the slots and runs the effects again, as React's development
// double-mount does. Both are checked to send exactly one request.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Slot = { value: unknown };

const harness = vi.hoisted(() => ({
  slots: [] as Slot[],
  index: 0,
  effects: [] as Array<() => void>,
}));

vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const slot = harness.slots[harness.index] ?? { value: initial };
    harness.slots[harness.index] = slot;
    harness.index += 1;
    const setState = (next: unknown) => {
      slot.value =
        typeof next === "function"
          ? (next as (prev: unknown) => unknown)(slot.value)
          : next;
    };
    return [slot.value, setState];
  },
  useRef: (initial: unknown) => {
    const slot = harness.slots[harness.index] ?? { value: { current: initial } };
    harness.slots[harness.index] = slot;
    harness.index += 1;
    return slot.value;
  },
  useEffect: (effect: () => void) => {
    harness.effects.push(effect);
  },
}));

import { useFigures, type FiguresState } from "./figures-api";

const VALID_BODY = {
  format: "revenant-figures-v1",
  generated_at: "2026-11-05T15:00:00Z",
  source_mode: "file",
  series: [],
};

/** Runs one render of the hook with the current slots, then its effects. */
function useRender(): FiguresState {
  harness.index = 0;
  harness.effects = [];
  const state = useFigures();
  for (const effect of harness.effects) effect();
  return state;
}

/** Runs the hook again on the same mounted instance, without effects. */
function useRerender(): FiguresState {
  harness.index = 0;
  harness.effects = [];
  return useFigures();
}

/** A new mount: fresh state, as when the reveal opens again. */
function useMount(): FiguresState {
  harness.slots = [];
  return useRender();
}

function okFetch() {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(VALID_BODY), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
}

async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe("useFigures: one request per reveal", () => {
  let fetchMock: ReturnType<typeof okFetch>;

  beforeEach(() => {
    harness.slots = [];
    harness.index = 0;
    harness.effects = [];
    fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("starts loading and sends one GET /api/figures on mount", async () => {
    const first = useMount();
    expect(first).toEqual({ status: "loading" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string] | undefined)?.[0]).toBe("/api/figures");
    await flush();
  });

  it("does not send a second request when the effects run again (strict double mount)", async () => {
    useMount();
    // Same instance, effects run again.
    for (const effect of harness.effects) effect();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not send another request on later renders of the same reveal", async () => {
    useMount();
    await flush();
    useRerender();
    useRerender();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns ready once the response has been parsed", async () => {
    useMount();
    await flush();
    expect(useRerender()).toEqual({ status: "ready", figures: VALID_BODY });
  });

  it("sends a new request for a new reveal (a fresh mount)", async () => {
    useMount();
    await flush();
    useMount();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports failed when the request fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    useMount();
    await flush();
    expect(useRerender()).toEqual({ status: "failed" });
  });
});
