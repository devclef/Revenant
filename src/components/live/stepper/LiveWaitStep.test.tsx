// Static-markup tests for the Wait card (spec 09, D5). Rendered with
// renderToStaticMarkup because the test environment is Node. Effects do not
// run here, so the countdown's live ticking and the single letter request at
// zero are pinned by the pure rules in unlock-in-place.test.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";
import type { SealedState } from "../SealedView";

import { LiveWaitStep } from "./LiveWaitStep";

const OPENS_AT = "2026-11-08T00:00:00.000Z";
const OPENS_MS = Date.parse(OPENS_AT);

const sealed: SealedState = {
  tag: "sealed",
  letterId: "AAAAAAAAAAAAAAAAAAAAAA",
  sealedAt: "2026-11-07T12:00:00.000Z",
  opensAt: OPENS_AT,
  offsetMs: 0,
  factors: "passkey",
  envelopeHash: "a".repeat(64),
};

function render(
  step: "wait" | "testify" | "break" | "receipts",
  nowMs: number,
): string {
  return renderToStaticMarkup(
    createElement(LiveWaitStep, {
      state: sealed,
      appOrigin: "https://revenant.example",
      step,
      advanceTo: () => undefined,
      nowMs: () => nowMs,
    }),
  );
}

describe("LiveWaitStep on the Wait card (D5.1)", () => {
  it("shows the countdown and no flow before zero", () => {
    const html = render("wait", OPENS_MS - 60_000);
    expect(html).toContain('data-live-countdown="ticking"');
    expect(html).toContain(LIVE_COPY.countdown.replace("{seconds}", "60"));
    // The flow mounts only at zero, so its ceremony root is absent (D5.2).
    expect(html).not.toContain("data-ceremony");
  });

  it("offers Go to your letter below the countdown, disabled until zero", () => {
    const html = render("wait", OPENS_MS - 60_000);
    expect(html).toContain("data-live-goto");
    expect(html).toContain('data-disabled="true"');
    expect(html).not.toMatch(/<a [^>]*data-live-goto/);
  });

  // Retired (spec 12, X1): this asserted that the flow's data-ceremony root
  // rendered inside the Wait step's markup at zero. The flow now portals into
  // the Reveal_Host, a sibling below the card, and react-dom/server cannot
  // render portals. The portal target is pinned by flowPortalTarget in
  // live-steps.test.ts, and the portal call by the source scan below.
  it("drops the countdown at zero and leaves the flow to the Reveal_Host", () => {
    const html = render("wait", OPENS_MS + 1_000);
    expect(html).not.toContain('data-live-countdown="ticking"');
    expect(html).not.toContain("data-ceremony");
  });

  it("links to the letter page once the countdown has ended", () => {
    const html = render("wait", OPENS_MS + 1_000);
    expect(html).toMatch(/<a [^>]*data-live-goto[^>]*>/);
    expect(html).toContain('href="/l/AAAAAAAAAAAAAAAAAAAAAA"');
  });

  // Retired (spec 12, X1): this asserted data-ceremony in the Testify markup,
  // for the same reason as the zero case above. The rest of the check stays.
  it("keeps the wait content off Testify without the countdown or Go to your letter", () => {
    const html = render("testify", OPENS_MS + 1_000);
    expect(html).not.toContain("data-live-goto");
    expect(html).not.toContain('data-live-countdown="ticking"');
    expect(html).not.toContain("data-card");
  });
});

// Spec 12, X1. The flow is portalled into the Reveal_Host. The server renderer
// cannot render portals, so the portal call is pinned by reading the source.
describe("LiveWaitStep portals the flow into the Reveal_Host (X1)", () => {
  const source = readFileSync(
    join(process.cwd(), "src/components/live/stepper/LiveWaitStep.tsx"),
    "utf8",
  );

  it("uses createPortal with the host target from flowPortalTarget", () => {
    expect(source).toContain('import { createPortal } from "react-dom";');
    expect(source).toMatch(/flowPortalTarget\(host, step, done\)/);
    expect(source).toMatch(
      /createPortal\(\s*<OpeningFlow[\s\S]*?flowTarget,\s*\)/,
    );
  });

  it("no longer wraps the flow in the letter column", () => {
    expect(source).not.toContain("letterColumn");
  });

  // The portal sits in a fixed slot of the children, so its position never
  // changes between steps. Only the target decides whether it renders, and the
  // flow therefore mounts once and is not remounted on re-render (X1).
  it("keeps the portal in one fixed slot, gated only by the target", () => {
    expect(source).toMatch(/\{flowTarget !== null \? \(\s*createPortal\(/);
    expect(source).not.toMatch(/createPortal\([\s\S]*?step === "/);
    expect(source).not.toMatch(/createPortal\([\s\S]*?key=/);
  });

  it("takes the host only from the stepper's prop, never from a query", () => {
    expect(source).toContain("host?: HTMLElement | null;");
    expect(source).not.toMatch(/document\.(querySelector|getElementById)/);
  });
});

describe("LiveWaitStep rehearsal line (spec 11, L4)", () => {
  function renderWith(rehearsal: boolean | undefined): string {
    return renderToStaticMarkup(
      createElement(LiveWaitStep, {
        state: sealed,
        appOrigin: "https://revenant.example",
        step: "wait",
        advanceTo: () => undefined,
        nowMs: () => OPENS_MS - 60_000,
        rehearsal,
      }),
    );
  }

  it("shows the rehearsal line beside the countdown when the prop is set", () => {
    const html = renderWith(true);
    expect(html).toContain('data-live-rehearsal=""');
    expect(html).toContain(LIVE_COPY.rehearsalLine);
  });

  it("shows no rehearsal line when the prop is not set", () => {
    expect(renderWith(undefined)).not.toContain("data-live-rehearsal");
    expect(renderWith(false)).not.toContain(LIVE_COPY.rehearsalLine);
  });
});

// Issue #385: the seal break is a step of its own. The Wait card is not drawn
// there, so no countdown or key reminder shows, and the stepper passes the
// break step through without remounting the flow (see live-steps.test.ts).
describe("LiveWaitStep on the seal break step (issue #385)", () => {
  it("draws no countdown on the break step", () => {
    const html = render("break", OPENS_MS + 60_000);
    expect(html).not.toContain("data-live-countdown");
    expect(html).not.toContain("data-live-goto");
  });
});
