// Feature: 09-demo-polish, spec frontend-dev C4 (Top_Bar Skip at marks)
//
// The Top_Bar Skip shows only while a sequence is registered. The Seal_Break
// registers only from the button press until the seal breaks
// (`skipRegisteredFor`), so the marks stage shows no Skip. The Skip_Link ("Skip
// to the receipts") sends SHOW_ALL once and moves focus to the Figures_Heading.
//
// The repo runs in the node environment, so the Top_Bar markup comes from
// renderToStaticMarkup. The registered-state value is fed in through the mocked
// `useSequence().hasActive`, computed by the same gate SealBreak uses.

import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CEREMONY_COPY } from "../copy";
import { focusTargetFor, stageFor } from "../stages";
import {
  activateSkipLink,
  skipLinkVisible,
  skipRegisteredFor,
  type SkipLinkSeal,
} from "../seal/skip-link";
import { TopBar } from "./TopBar";

let skipActive = false;

vi.mock("../motion", () => ({
  useMotion: () => ({ mode: "full", setCalm: vi.fn() }),
  MotionProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("../skip", () => ({
  useSequence: () => ({
    hasActive: skipActive,
    register: () => () => {},
    skipAll: vi.fn(),
  }),
  SkipProvider: ({ children }: { children: ReactNode }) => children,
}));

const SKIP = CEREMONY_COPY.skip;

/** The Top_Bar markup for a seal whose registration is `(breaking, broken)`. */
function topBarFor(breaking: boolean, broken: boolean): string {
  skipActive = skipRegisteredFor(breaking, broken);
  return renderToStaticMarkup(createElement(TopBar, {}));
}

describe("Top_Bar Skip at the marks stage", () => {
  it("shows no Top_Bar Skip while the seal waits at its marks (nothing pressed)", () => {
    const html = topBarFor(false, false);
    expect(html).not.toContain(`aria-label="${SKIP}"`);
  });

  it("shows the Top_Bar Skip once the button starts a break", () => {
    const html = topBarFor(true, false);
    expect(html).toContain(`aria-label="${SKIP}"`);
  });

  it("drops the Top_Bar Skip again once the seal has broken", () => {
    const html = topBarFor(true, true);
    expect(html).not.toContain(`aria-label="${SKIP}"`);
  });
});

describe("skipRegisteredFor (the gate SealBreak registers through)", () => {
  it("is false at the marks, before any press", () => {
    expect(skipRegisteredFor(false, false)).toBe(false);
  });

  it("is true from the press until the break settles", () => {
    expect(skipRegisteredFor(true, false)).toBe(true);
  });

  it("is false once the seal has broken", () => {
    expect(skipRegisteredFor(true, true)).toBe(false);
  });
});

describe("Skip to the receipts (Skip_Link at marks)", () => {
  /** A controller whose showAll breaks the seal, as useSealBreak's does. */
  function fakeSeal(): SkipLinkSeal & { showAll: ReturnType<typeof vi.fn> } {
    const seal = {
      broken: false,
      showAll: vi.fn(() => {
        seal.broken = true;
      }),
    };
    return seal;
  }

  it("is shown at the marks while the seal is intact", () => {
    expect(skipLinkVisible(true, false)).toBe(true);
  });

  it("sends SHOW_ALL exactly once", () => {
    const seal = fakeSeal();
    activateSkipLink(seal);
    activateSkipLink(seal);
    expect(seal.showAll).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the Figures_Heading when it goes marks to figures", () => {
    // SHOW_ALL sets reveal stage 3. The figures fade-up is running, so the
    // Stage is `figures` before it settles to `close`.
    const stage = stageFor(
      {
        tag: "reveal",
        opened: undefined as never,
        record: undefined as never,
        stage: 3,
      },
      { emergence: "done", sealing: false, figures: "running" },
    );
    expect(stage).toBe("figures");
    expect(focusTargetFor("marks", stage, { authorQuestions: false, figures: true })).toEqual({ kind: "figures-heading" });
  });

  it("moves focus to the Figures_Heading when it goes seal to close", () => {
    expect(focusTargetFor("seal", "close", { authorQuestions: false, figures: true })).toEqual({
      kind: "figures-heading",
    });
  });
});
