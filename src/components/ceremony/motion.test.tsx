// Feature: 05-reveal-ceremony
//
// Tests for the Motion context (motion.ts). The task names four things to
// prove:
//
//   1. the provider yields `full` on the server / first client render,
//      regardless of a stubbed prefers-reduced-motion (R17.3: final state is
//      the starting state, so the server and the first client render agree and
//      hydration never mismatches);
//   2. the pure low-power decision helper returns the low-power verdict for
//      few cores, Save-Data, or a slow frame probe, and stays non-low-power by
//      default;
//   3. the pure mode resolver turns the Calm control on into `calm` mode;
//   4. `setCalm` touches no storage API (R1.5: Calm lives in React state only,
//      no persistence, no network).
//
// How these are observed in this repo's test setup
// ------------------------------------------------
// The repo has no DOM test environment and no @testing-library/react. Every
// component test runs in Vitest's `node` environment and reads React through
// `renderToStaticMarkup` (see skip.test.tsx, DeskScene.test.tsx). We add no
// dependency, so these tests follow that house style:
//
//   - The first-render mode is read straight off `renderToStaticMarkup`, which
//     runs render only — the layout effect that reads the device signals never
//     fires — so whatever `matchMedia` is stubbed to return, the captured mode
//     is the starting `full` (behaviour 1).
//   - The low-power OR and the mode derivation are pure, exported helpers
//     (`decideLowPower`, `resolveMode`) that the provider itself calls, so a
//     direct unit test drives the exact shipping logic without a mounted tree
//     (behaviours 2 and 3). Proving the `calm` flip through `resolveMode` is
//     honest here precisely because the provider's own `useMemo` calls it.
//   - `setCalm`'s no-storage guarantee is observed by spying every storage API
//     and confirming none is touched when it is called (behaviour 4).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MotionProvider,
  decideLowPower,
  resolveMode,
  useMotion,
  type MotionContextValue,
} from "./motion";

/**
 * Render `MotionProvider` once and hand back the live context value a child
 * saw on the first render, plus the static HTML it produced. The value's
 * `setCalm` is a stable closure over the provider's state setter, so it can be
 * called after this returns; `mode` is the first-render mode.
 */
function captureFirstRender(): { ctx: MotionContextValue; html: string } {
  let captured: MotionContextValue | null = null;
  function Probe() {
    captured = useMotion();
    return null;
  }
  const html = renderToStaticMarkup(
    createElement(MotionProvider, null, createElement(Probe)),
  );
  if (captured === null) {
    throw new Error("Probe never read the Motion context");
  }
  return { ctx: captured, html };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MotionProvider — first render is always full (behaviour 1, R17.3)", () => {
  it("yields `full` on the first render when no matchMedia is present", () => {
    const { ctx } = captureFirstRender();
    expect(ctx.mode).toBe("full");
  });

  it("still yields `full` on the first render even with prefers-reduced-motion stubbed to match", () => {
    // Stub a window.matchMedia that reports reduced motion. The layout effect
    // that would read it never runs under renderToStaticMarkup, so the first
    // render must still be `full` — the server and the first client render
    // agree and hydration cannot mismatch.
    vi.stubGlobal("window", {
      matchMedia: () => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });

    const { ctx } = captureFirstRender();
    expect(ctx.mode).toBe("full");
  });

  it("exposes a setCalm function on the context", () => {
    const { ctx } = captureFirstRender();
    expect(typeof ctx.setCalm).toBe("function");
  });
});

describe("decideLowPower — the pure low-power decision (behaviour 2)", () => {
  it("is low-power when fewer than LOW_POWER_CORES cores are reported", () => {
    expect(
      decideLowPower({ fewCores: true, saveData: false, slowFrame: false }),
    ).toBe(true);
  });

  it("is low-power when Save-Data is on", () => {
    expect(
      decideLowPower({ fewCores: false, saveData: true, slowFrame: false }),
    ).toBe(true);
  });

  it("is low-power when the frame probe measured a slow frame", () => {
    expect(
      decideLowPower({ fewCores: false, saveData: false, slowFrame: true }),
    ).toBe(true);
  });

  it("is low-power when several signals fire at once", () => {
    expect(
      decideLowPower({ fewCores: true, saveData: true, slowFrame: true }),
    ).toBe(true);
  });

  it("is NOT low-power by default, with no signal set", () => {
    expect(
      decideLowPower({ fewCores: false, saveData: false, slowFrame: false }),
    ).toBe(false);
  });
});

describe("resolveMode — the pure mode resolution (behaviour 2 and 3)", () => {
  const BASE = { reducedMotion: false, calmControl: false, lowPower: false };

  it("is `full` with no signal", () => {
    expect(resolveMode(BASE)).toBe("full");
  });

  it("is `light` for a low-power device", () => {
    expect(resolveMode({ ...BASE, lowPower: true })).toBe("light");
  });

  it("is `calm` when prefers-reduced-motion is on", () => {
    expect(resolveMode({ ...BASE, reducedMotion: true })).toBe("calm");
  });

  it("flips to `calm` when the Calm control is turned on", () => {
    // The judge's Calm control. resolveMode is exactly the provider's own
    // mode useMemo, so this proves setCalm(true) -> `calm`.
    expect(resolveMode({ ...BASE, calmControl: true })).toBe("calm");
  });

  it("lets calm win over low-power", () => {
    expect(resolveMode({ ...BASE, calmControl: true, lowPower: true })).toBe(
      "calm",
    );
  });
});

describe("setCalm — React state only, no storage (behaviour 4, R1.5)", () => {
  it("does not read or write any storage API when toggled on or off", () => {
    // A storage double that records every access. If setCalm persisted the
    // Calm choice anywhere, one of these would fire.
    const makeStore = () => ({
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0,
    });
    const local = makeStore();
    const session = makeStore();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);

    const { ctx } = captureFirstRender();
    ctx.setCalm(true);
    ctx.setCalm(false);

    for (const store of [local, session]) {
      expect(store.getItem).not.toHaveBeenCalled();
      expect(store.setItem).not.toHaveBeenCalled();
      expect(store.removeItem).not.toHaveBeenCalled();
      expect(store.clear).not.toHaveBeenCalled();
    }
  });

  it("does not throw when toggled (it is a plain state setter)", () => {
    const { ctx } = captureFirstRender();
    expect(() => {
      ctx.setCalm(true);
      ctx.setCalm(false);
    }).not.toThrow();
  });
});

describe("useMotion — provider boundary", () => {
  it("throws a clear error when used outside a MotionProvider", () => {
    function Orphan() {
      useMotion();
      return null;
    }
    expect(() => renderToStaticMarkup(createElement(Orphan))).toThrow(
      /must be used within a MotionProvider/,
    );
  });
});

describe("MotionProvider — nesting", () => {
  it("a nested provider shares the parent's context value", () => {
    const seen: MotionContextValue[] = [];
    function Probe() {
      seen.push(useMotion());
      return null;
    }
    function Outer() {
      seen.push(useMotion());
      return createElement(MotionProvider, null, createElement(Probe));
    }
    renderToStaticMarkup(createElement(MotionProvider, null, createElement(Outer)));
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
  });
});
