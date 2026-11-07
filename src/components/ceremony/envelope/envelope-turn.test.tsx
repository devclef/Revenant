// Turn tests for Envelope (07-judge-journey, design.md "The Envelope"; R10.8,
// R10.9). The turn starts at ENVELOPE_TURN_AT_MS and ends by 920 ms. In Calm
// the back shows in the same render with no animation.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ENVELOPE_TURN_AT_MS,
  ENVELOPE_TURN_MS,
} from "@/components/ceremony/constants";

import { Envelope, type EnvelopePersona } from "./Envelope";
import styles from "./Envelope.module.css";

const PERSONA: EnvelopePersona = {
  key: "us-maya",
  written_as_of: "2024-11-05",
  opens_at: "2024-11-05T00:00:00.000Z",
  demo: true,
};

const render = (state: "closed" | "turned" | "open"): string =>
  renderToStaticMarkup(createElement(Envelope, { state, persona: PERSONA }));

describe("Envelope turn timing (R10.8)", () => {
  it("ends the turn by 920 ms", () => {
    expect(ENVELOPE_TURN_AT_MS).toBe(400);
    expect(ENVELOPE_TURN_MS).toBe(520);
    expect(ENVELOPE_TURN_AT_MS + ENVELOPE_TURN_MS).toBeLessThanOrEqual(920);
  });

  it("sets the turn delay and duration inline on a turned envelope", () => {
    const html = render("turned");
    expect(html).toContain(`animation-delay:${ENVELOPE_TURN_AT_MS}ms`);
    expect(html).toContain(`animation-duration:${ENVELOPE_TURN_MS}ms`);
  });

  it("does not turn a closed envelope", () => {
    const html = render("closed");
    expect(html).not.toContain("animation-delay");
    expect(html).not.toContain(styles.turned);
  });
});

describe("Envelope back in the same render (R10.9)", () => {
  it("puts the turned pose on the turner, so Calm shows the back with no motion", () => {
    // Calm and reduced motion remove only the `turning` animation in CSS, and
    // keep the `turned` end pose, so the back shows in this same render.
    const html = render("turned");
    expect(html).toContain(styles.turned);
  });

  it("draws the one wax seal on the back face", () => {
    const html = render("turned");
    expect(html.split(styles.faceBack).length - 1).toBe(1);
    // The seal's two halves each draw the wax blob once.
    expect((html.match(/M50 4 C74 3 96 22/g) ?? []).length).toBe(2);
  });
});

describe("Envelope static end pose (animate=false)", () => {
  it("shows the turned back with no turn animation or delay", () => {
    const html = renderToStaticMarkup(
      createElement(Envelope, { state: "turned", persona: PERSONA, animate: false }),
    );
    expect(html).toContain(styles.turned);
    expect(html).not.toContain(styles.turning);
    expect(html).not.toContain("animation-delay");
    expect(html).not.toContain("animation-duration");
  });

  it("still animates a turned envelope by default", () => {
    const html = renderToStaticMarkup(
      createElement(Envelope, { state: "turned", persona: PERSONA }),
    );
    expect(html).toContain(styles.turning);
    expect(html).toContain(`animation-delay:${ENVELOPE_TURN_AT_MS}ms`);
  });
});
