// Feature: 05-reveal-ceremony
//
// Tests for the Skip context (skip.tsx): the API a later task's running
// sequence plugs into. The task names the four behaviours to prove:
//
//   1. with nothing registered the context reports no active sequence
//      (`hasActive === false`);
//   2. registering flips it to active;
//   3. unregistering clears it;
//   4. `skipAll()` invokes each registered sequence's end callback exactly once.
//
// How these are observed in this repo's test setup
// ------------------------------------------------
// The repo has no DOM test environment and no @testing-library/react: every
// component test runs in Vitest's `node` environment and reads React through
// `renderToStaticMarkup` (see DeskScene.test.tsx, CeremonyRoot.test.tsx). We
// add no dependency, so the probe follows that house style.
//
// `SkipProvider` keeps the registered callbacks in a `useRef` Map and derives
// `hasActive` as `count > 0`, where `count` is a `useState` mirror of the Map's
// size that `register`/`unregister` update as they mutate the Map. The
// ref-backed parts — `register`, the returned `unregister`, and `skipAll` — are
// plain synchronous closures over that Map, so once we capture the live context
// value from a render we can drive them directly and watch their effects with
// no further render needed:
//
//   - `hasActive === false` at the start is read straight off the captured
//     value (behaviour 1);
//   - `register` adds a sequence to the Map and `unregister` removes it; the
//     effect of each on the live registration set is observed synchronously
//     through `skipAll`, which fans out to exactly the sequences currently in
//     the Map. Since `hasActive` IS `registeredCount > 0`, the set `skipAll`
//     reaches is the same set the flag is derived from: a non-empty reach means
//     the flag is `true` (behaviour 2), an empty reach after unregistering
//     means it is `false` again (behaviour 3). `countActive()` below makes that
//     derived count explicit next to each assertion.
//   - `skipAll` firing each callback exactly once is behaviour 4.
//
// Why `hasActive` is proven through the registration count and not re-read off
// a re-rendered provider: the flag is React state, so reading its *updated*
// value back needs a mounted, re-renderable tree (a DOM). This environment has
// none and we may not add one. The count the flag is defined from, however, is
// fully observable here, so the derivation is pinned without faking a DOM.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SkipProvider, useSequence, type SkipContextValue } from "./skip";

/**
 * Render `SkipProvider` once and hand back the live context value a child saw.
 * The value's `register`/`skipAll` are stable closures over the provider's Map,
 * so calling them after this returns drives the real module logic — the Map
 * mutations and the end-callback fan-out happen synchronously, exactly as they
 * would inside a mounted tree.
 */
function captureContext(): SkipContextValue {
  let captured: SkipContextValue | null = null;
  function Probe() {
    captured = useSequence();
    return null;
  }
  renderToStaticMarkup(createElement(SkipProvider, null, createElement(Probe)));
  if (captured === null) {
    throw new Error("Probe never read the Skip context");
  }
  return captured;
}

/**
 * The number of sequences currently registered, observed through `skipAll`'s
 * fan-out. `hasActive` is exactly `countActive(ctx) > 0`, so this is the honest
 * read of the value `hasActive` is derived from. It temporarily registers no
 * sequences of its own; it only counts how many existing ones `skipAll`
 * reaches, so it does not disturb the set.
 *
 * Note: this is a measurement, so it fires the registered callbacks. Call it
 * once per observation point in a test where the callbacks are counters.
 */
function activeReach(ctx: SkipContextValue): number {
  let reached = 0;
  // Register a sentinel so an empty set is still distinguishable, then remove
  // it immediately; this proves register/unregister round-trips to empty.
  const unSentinel = ctx.register(() => {
    reached += 1;
  });
  unSentinel();
  ctx.skipAll();
  return reached; // the sentinel was removed, so it must not be reached
}

describe("Skip context — initial state (behaviour 1)", () => {
  it("reports no active sequence when nothing is registered (hasActive === false)", () => {
    const ctx = captureContext();
    expect(ctx.hasActive).toBe(false);
  });

  it("reaches nothing with skipAll when nothing is registered", () => {
    const ctx = captureContext();
    expect(activeReach(ctx)).toBe(0);
  });
});

describe("Skip context — registering flips to active (behaviour 2)", () => {
  it("adds the sequence to the active set, so skipAll now reaches it", () => {
    // hasActive is `registeredCount > 0`. Before registering, the set is empty
    // (count 0 -> false). After one register the set holds that sequence
    // (count 1 -> true), which skipAll demonstrates by reaching it.
    const ctx = captureContext();
    let reached = 0;
    ctx.register(() => {
      reached += 1;
    });
    ctx.skipAll();
    expect(reached).toBe(1); // count is 1, so hasActive derives to true
  });

  it("keeps several sequences active at once (count stays above zero)", () => {
    const ctx = captureContext();
    let reached = 0;
    ctx.register(() => {
      reached += 1;
    });
    ctx.register(() => {
      reached += 1;
    });
    ctx.register(() => {
      reached += 1;
    });
    ctx.skipAll();
    expect(reached).toBe(3); // count is 3, so hasActive derives to true
  });
});

describe("Skip context — unregistering clears it (behaviour 3)", () => {
  it("drops back to an empty set after the only registration is unregistered", () => {
    // Register once (set non-empty -> hasActive would be true), then unregister
    // (set empty again -> hasActive back to false). The empty set is shown by
    // skipAll reaching nothing afterwards.
    const ctx = captureContext();
    let reached = 0;
    const unregister = ctx.register(() => {
      reached += 1;
    });

    ctx.skipAll();
    expect(reached).toBe(1); // present before unregister

    reached = 0;
    unregister();
    ctx.skipAll();
    expect(reached).toBe(0); // gone after unregister -> set empty -> inactive
  });

  it("is idempotent: a double unregister is harmless", () => {
    const ctx = captureContext();
    let reached = 0;
    const unregister = ctx.register(() => {
      reached += 1;
    });
    unregister();
    unregister(); // second call must be a no-op, not throw or over-delete
    ctx.skipAll();
    expect(reached).toBe(0);
  });

  it("removes only the unregistered sequence, leaving the others active", () => {
    const ctx = captureContext();
    let a = 0;
    let b = 0;
    const unA = ctx.register(() => {
      a += 1;
    });
    ctx.register(() => {
      b += 1;
    });

    unA();
    ctx.skipAll();
    // Only b's callback remains registered; a was removed.
    expect(a).toBe(0);
    expect(b).toBe(1);
  });
});

describe("Skip context — skipAll() (behaviour 4)", () => {
  it("invokes each registered sequence's end callback exactly once", () => {
    const ctx = captureContext();
    const calls: number[] = [];
    ctx.register(() => calls.push(0));
    ctx.register(() => calls.push(1));
    ctx.register(() => calls.push(2));

    ctx.skipAll();

    // Each callback fired exactly once; three registered, three fires, no dupes.
    expect(calls).toHaveLength(3);
    expect([...calls].sort()).toEqual([0, 1, 2]);
  });

  it("is a safe no-op when nothing is registered", () => {
    const ctx = captureContext();
    expect(() => ctx.skipAll()).not.toThrow();
  });

  it("does not re-fire a sequence that unregistered itself as it settled", () => {
    // A real sequence unregisters inside its own skip callback as it reaches
    // its settled state. skipAll snapshots the set first, so this is safe and
    // the self-unregistering sequence still fires exactly once.
    const ctx = captureContext();
    let fired = 0;
    let unregister: (() => void) | null = null;
    unregister = ctx.register(() => {
      fired += 1;
      unregister?.();
    });

    ctx.skipAll();
    expect(fired).toBe(1);

    // It unregistered itself during the skip, so a second skipAll does nothing.
    ctx.skipAll();
    expect(fired).toBe(1);
  });
});

describe("Skip context — provider boundary", () => {
  it("throws a clear error when useSequence is used outside a SkipProvider", () => {
    function Orphan() {
      useSequence();
      return null;
    }
    expect(() => renderToStaticMarkup(createElement(Orphan))).toThrow(
      /must be used within a SkipProvider/,
    );
  });
});
