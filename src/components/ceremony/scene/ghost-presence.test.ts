// Feature: 07-judge-journey (task 5)
//
// Property 22, break clause (design.md "Property 22", R12.10, R12.9, R12.8): in
// Calm the break plan is empty and the Ghost unmounts in the ADVANCE render.
// The Ghost stays mounted only for the leave of a full-motion break.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GHOST_EXIT_FALLBACK_MS, GHOST_LEAVE_MS } from "../constants";
import { planSealBreak } from "../seal/SealBreak";
import { SkipProvider, useSequence, type SkipContextValue } from "../skip";
import { ghostExitFallbackMs, ghostPresent, isGhostExitEnd } from "./ghost-presence";

/**
 * The live SkipProvider context, captured through a probe (house style: no DOM,
 * see skip.test.tsx). `register` and `skipAll` are closures over the provider's
 * registration map, so they can be driven directly here.
 */
function captureSequence(): SkipContextValue {
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

describe("Property 22: break clause (R12.10, R12.9, R12.8)", () => {
  it("plans no break steps in Calm", () => {
    expect(planSealBreak({ calm: true }).steps).toEqual([]);
  });

  it("unmounts the Ghost in the ADVANCE render when no leave is running (Calm, Skip)", () => {
    expect(ghostPresent({ tag: "reveal", stage: 2, leaving: false })).toBe(false);
  });

  it("keeps the Ghost mounted through the leave of a full-motion break", () => {
    expect(ghostPresent({ tag: "reveal", stage: 2, leaving: true })).toBe(true);
  });

  it("removes the Ghost at once for Show everything, which jumps to stage 3", () => {
    expect(ghostPresent({ tag: "reveal", stage: 3, leaving: false })).toBe(false);
  });
});

describe("Ghost presence before and during the break (design.md \"The dissolve on break\")", () => {
  it("mounts the Ghost for every pre-reveal state, so the envelope is held", () => {
    for (const tag of ["loading", "sealed", "openable", "verifying", "recall"]) {
      expect(ghostPresent({ tag, stage: null, leaving: false })).toBe(true);
    }
  });

  it("mounts the Ghost while holding the seal at stage 1", () => {
    expect(ghostPresent({ tag: "reveal", stage: 1, leaving: false })).toBe(true);
  });

  it("has no Ghost in a fresh letter, figures or close render (no leave running)", () => {
    for (const stage of [2, 3] as const) {
      expect(ghostPresent({ tag: "reveal", stage, leaving: false })).toBe(false);
    }
  });
});

describe("Ghost exit lifecycle (spec 07 A11, issue #253)", () => {
  // Example tests for each removal path: animationend, the fallback timer,
  // Calm_Mode and Skip. PersonaGhost.tsx wires these rules to the Ghost.

  it("removes the Ghost on animationend of the leave (ghostLeave)", () => {
    expect(isGhostExitEnd("ghostLeave")).toBe(true);
    // CSS modules may prefix the keyframe name.
    expect(isGhostExitEnd("_ghostLeave_1a2b3")).toBe(true);
  });

  it("does not remove the Ghost on the other animations (rise, bob, ghostFade)", () => {
    expect(isGhostExitEnd("rise")).toBe(false);
    expect(isGhostExitEnd("bob")).toBe(false);
    // ghostFade ends before ghostLeave, so it does not end the exit.
    expect(isGhostExitEnd("ghostFade")).toBe(false);
  });

  it("removes the Ghost on the fallback timer when no animationend fires", () => {
    expect(ghostExitFallbackMs(false)).toBe(GHOST_EXIT_FALLBACK_MS);
    expect(GHOST_EXIT_FALLBACK_MS).toBeGreaterThan(GHOST_LEAVE_MS);
  });

  it("removes the Ghost at once under Calm_Mode", () => {
    expect(ghostExitFallbackMs(true)).toBe(0);
  });

  it("removes the Ghost at once when Skip runs the registered sequence", () => {
    // PersonaGhost registers `() => onLeft?.()` while the leave runs. Skip calls
    // every registered skip callback, so this drives the real SkipProvider's
    // register and skipAll with the same callback shape.
    const seq = captureSequence();
    let leaving = true;
    let leftCalls = 0;
    const onLeft = () => {
      leftCalls += 1;
      leaving = false;
    };
    const unregister = seq.register(() => onLeft());

    expect(ghostPresent({ tag: "reveal", stage: 2, leaving })).toBe(true);

    seq.skipAll();

    expect(leftCalls).toBe(1);
    expect(leaving).toBe(false);
    expect(ghostPresent({ tag: "reveal", stage: 2, leaving })).toBe(false);
    unregister();
  });

  it("does not call the skip callback once the leave has unregistered", () => {
    const seq = captureSequence();
    let leftCalls = 0;
    const unregister = seq.register(() => {
      leftCalls += 1;
    });
    unregister();

    seq.skipAll();

    expect(leftCalls).toBe(0);
  });
});

describe("PersonaGhost exit wiring (source examples, spec 07 A11)", () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "PersonaGhost.tsx"), "utf8");

  it("removes the Ghost on animationend through onExitEnd", () => {
    expect(source).toMatch(/isGhostExitEnd\(animationName\)\)\s*onLeft\?\.\(\)/);
    expect(source).toMatch(/onExitEnd=\{onExitEnd\}/);
  });

  it("removes the Ghost on the fallback timer", () => {
    expect(source).toMatch(/setTimeout\(\(\) => onLeft\?\.\(\), delay\)/);
  });

  it("removes the Ghost at once under Calm_Mode", () => {
    expect(source).toMatch(/if \(delay === 0\) \{\s*onLeft\?\.\(\);/);
  });

  it("removes the Ghost at once on Skip through the registered sequence", () => {
    expect(source).toMatch(/register\(\(\) => onLeft\?\.\(\)\)/);
  });
});
