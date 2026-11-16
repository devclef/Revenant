// The held Ghost on the live Wait card (spec 09, HeldGhost). The sink rule, the
// markup, the Calm and reduced-motion settled states, the motion limits in
// live.module.css, and the rule that the Ghost stays clear of the Keep_Section.

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { GHOST_SIZE_COMPACT } from "@/components/ceremony/constants";

import type { SealedState } from "../SealedView";

import { HeldGhost, heldGhostSink } from "./HeldGhost";
import { LiveGhost } from "./LiveGhost";
import { LiveWaitStep } from "./LiveWaitStep";

let calm = false;

vi.mock("@/components/ceremony/motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ceremony/motion")>();
  return {
    ...actual,
    useCalmInForce: () => calm,
    useMotion: () => ({ mode: calm ? "calm" : "full", setCalm: () => undefined }),
  };
});

const css = readFileSync(new URL("../live.module.css", import.meta.url), "utf8");

/** The body of one top-level rule whose selector starts with `selector`. */
function ruleBody(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `rule ${selector}`).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("heldGhostSink", () => {
  it("sinks while the countdown runs in full motion", () => {
    expect(heldGhostSink(false, false)).toBe("sinking");
  });

  it("holds the settled sunk pose while the countdown runs under Calm_Mode", () => {
    expect(heldGhostSink(false, true)).toBe("sunk");
  });

  it("rises (idle) at zero, in full motion and under Calm_Mode", () => {
    expect(heldGhostSink(true, false)).toBe("idle");
    expect(heldGhostSink(true, true)).toBe("idle");
  });
});

describe("HeldGhost markup", () => {
  it("draws the Scene Ghost at the compact size, held and pass-through", () => {
    const html = renderToStaticMarkup(createElement(HeldGhost, { sink: "sinking" }));
    expect(html).toContain("data-held-ghost");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("data-ghost-pit");
    expect(html).toContain("data-held-pit");
    expect(html).toContain(`data-size="${GHOST_SIZE_COMPACT}"`);
  });

  it("marks the sinking Ghost with data-sink=sinking and no rise on the first render", () => {
    const html = renderToStaticMarkup(createElement(HeldGhost, { sink: "sinking" }));
    expect(html).toContain('data-sink="sinking"');
  });

  it("holds the settled Calm pose with data-sink=sunk", () => {
    const html = renderToStaticMarkup(createElement(LiveGhost, { sink: "sunk" }));
    expect(html).toContain('data-sink="sunk"');
    expect(html).not.toContain('data-sink="sinking"');
  });

  it("leaves no sink attribute at zero, so the Ghost is risen and settled", () => {
    const html = renderToStaticMarkup(createElement(LiveGhost, { sink: "idle" }));
    expect(html).not.toContain("data-sink=");
  });
});

describe("the motion limits on the held Ghost (live.module.css)", () => {
  it("turns off the shake and the Idle_Bob for the held Ghost", () => {
    expect(ruleBody(".heldGhost [data-ghost-pit][data-held-pit]")).toMatch(/animation:\s*none/);
    expect(ruleBody(".heldGhost [data-held-pit] [data-ghost-bob]")).toMatch(/animation:\s*none/);
  });

  it("holds the sinking pose in reduced motion, where the sink does not animate", () => {
    expect(ruleBody(".heldGhost [data-held-pit] [data-ghost-rise][data-sink=\"sinking\"]"))
      .toMatch(/transform:\s*translateY\(105%\)/);
  });

  it("adds no keyframes of its own, so the sink and the rise stay the Scene's", () => {
    expect(css).not.toMatch(/@keyframes/);
  });

  it("does not animate the held box itself", () => {
    expect(ruleBody(".heldGhost")).not.toMatch(/animation/);
  });
});

describe("the held Ghost stays clear of the Keep_Section (no intersection)", () => {
  it("clips the Ghost to the envelope's light box", () => {
    const held = ruleBody(".heldGhost");
    expect(held).toMatch(/position:\s*absolute/);
    expect(held).toMatch(/inset:\s*0/);
    expect(held).toMatch(/overflow:\s*hidden/);
    expect(ruleBody(".envelopeLight")).toMatch(/position:\s*relative/);
  });

  it("passes pointer events through, so the controls under it stay usable", () => {
    expect(ruleBody(".heldGhost")).toMatch(/pointer-events:\s*none/);
  });

  it("draws the Ghost inside the envelope view, before the countdown and the Keep_Section", () => {
    calm = false;
    const sealed: SealedState = {
      tag: "sealed",
      letterId: "AAAAAAAAAAAAAAAAAAAAAA",
      sealedAt: "2026-11-07T12:00:00.000Z",
      opensAt: "2026-11-08T00:00:00.000Z",
      offsetMs: 0,
      factors: "backup",
      envelopeHash: "a".repeat(64),
    };
    const html = renderToStaticMarkup(
      createElement(LiveWaitStep, {
        state: sealed,
        appOrigin: "https://revenant.example",
        step: "wait",
        advanceTo: () => undefined,
        nowMs: () => Date.parse(sealed.opensAt) - 60_000,
      }),
    );
    const view = html.indexOf("data-sealed-envelope-view");
    const ghost = html.indexOf("data-held-ghost");
    const countdown = html.indexOf('data-live-countdown="ticking"');
    const keep = html.indexOf("data-live-keep-section");
    expect(ghost).toBeGreaterThan(view);
    expect(countdown).toBeGreaterThan(ghost);
    expect(keep).toBeGreaterThan(countdown);
  });

  it("holds the sunk pose on the Wait card under Calm_Mode, and rises at zero", () => {
    const sealed: SealedState = {
      tag: "sealed",
      letterId: "AAAAAAAAAAAAAAAAAAAAAA",
      sealedAt: "2026-11-07T12:00:00.000Z",
      opensAt: "2026-11-08T00:00:00.000Z",
      offsetMs: 0,
      factors: "backup",
      envelopeHash: "a".repeat(64),
    };
    const render = (nowMs: number) => {
      calm = true;
      return renderToStaticMarkup(
        createElement(LiveWaitStep, {
          state: sealed,
          appOrigin: "https://revenant.example",
          step: "wait",
          advanceTo: () => undefined,
          nowMs: () => nowMs,
        }),
      );
    };
    expect(render(Date.parse(sealed.opensAt) - 60_000)).toContain('data-sink="sunk"');
    expect(render(Date.parse(sealed.opensAt) + 1_000)).not.toContain("data-sink=");
    calm = false;
  });
});
