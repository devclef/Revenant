// Stage-coverage tests for EnvelopeView (05-reveal-ceremony, design.md
// "Envelope and seal"; R7.2, R7.5, R8.7, R15.1, and Property 2's envelope
// clauses).
//
// EnvelopeView owns every pre-reveal scene. It is rendered here with
// `renderToStaticMarkup` and `createElement` — no DOM library, no JSX — so the
// whole scene (envelope SVG + statements + the reused StillSealed view) is a
// string we can scan. StillSealed seeds its display-only countdown to the
// opening instant on the first (server) frame, so a static render always shows
// the "Try again" control; that is the frame we assert against here.
//
// What these pin:
//   - Stage coverage: `loading`, `openable` and `verifying` all render the
//     envelope Stage (the closed envelope). The `verifying` statement
//     ("Checking the seal.") and the `loading` statement sit in a
//     `role="status"` region; `openable` is a silent transition.
//   - `sealed` shows the opening date, the time remaining and "Try again", and
//     NOTHING about the contents (R7.2).
//   - R8.7: every scene draws the envelope at the resting geometry — the
//     literals from constants.ts appear in the rendered inline style.
//   - With no persona: the default seal pattern and no dates (spec 03 renders).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "@/components/reveal/copy";
import { LocalViewProvider } from "../local-view";
import { EnvelopeView } from "./EnvelopeView";
import type {
  EnvelopeViewProps,
  EnvelopeViewVariant,
} from "./EnvelopeView";
import type { EnvelopePersona } from "./Envelope";

/** The resting geometry EnvelopeView draws the envelope at (R8.7). */
const RESTING_WIDTH = "min(84vw, 26rem)";
const RESTING_TOP = "max(6rem, 14vh)";

/** A fixed persona: the only per-letter fields EnvelopeView feeds the envelope. */
const PERSONA: EnvelopePersona = {
  key: "us-maya",
  written_as_of: "2024-05-12",
  // A past opening instant, so StillSealed's static (seeded) frame is at zero
  // and shows the "Try again" control deterministically.
  opens_at: "2024-11-05T00:00:00.000Z",
  demo: true,
};

const render = (props: EnvelopeViewProps): string =>
  renderToStaticMarkup(
    createElement(
      LocalViewProvider,
      null,
      createElement(EnvelopeView, props),
    ),
  );

/** The closed envelope's fixed SVG label — present whenever the paper is drawn. */
const ENVELOPE_LABEL = 'aria-hidden="true"';

describe("EnvelopeView — the envelope Stage covers loading / openable / verifying", () => {
  const statementVariants: readonly EnvelopeViewVariant[] = [
    "loading",
    "openable",
    "verifying",
  ] as const;

  it("draws the closed envelope for every statement variant", () => {
    for (const variant of statementVariants) {
      const html = render({ variant, persona: PERSONA });
      expect(html, `variant ${variant} must draw the envelope`).toContain(
        ENVELOPE_LABEL,
      );
      // The envelope rests closed through every pre-reveal scene.
      expect(html).toContain('data-envelope-state="closed"');
    }
  });

  it("announces the verifying statement in a role=status region (R7.5)", () => {
    const html = render({ variant: "verifying", persona: PERSONA });
    expect(html).toContain(REVEAL_COPY.verifying);
    // The statement is a polite live region so a screen reader hears it.
    expect(html).toMatch(/role="status"[^>]*>[^<]*Checking the seal\./);
  });

  it("announces the loading statement in a role=status region", () => {
    const html = render({ variant: "loading", persona: PERSONA });
    expect(html).toContain(REVEAL_COPY.loading);
    expect(html).toMatch(
      /role="status"[^>]*>[^<]*Bringing the letter into the light\./,
    );
  });

  it("shows no statement for the silent openable transition", () => {
    const html = render({ variant: "openable", persona: PERSONA });
    // openable is a brief transition: the envelope, but neither statement.
    expect(html).not.toContain(REVEAL_COPY.loading);
    expect(html).not.toContain(REVEAL_COPY.verifying);
    expect(html).not.toContain('role="status"');
  });
});

describe("EnvelopeView — sealed shows the date and countdown, nothing about contents (R7.2)", () => {
  const html = render({ variant: "sealed", persona: PERSONA });

  it("shows the opening date and the still-sealed body", () => {
    expect(html).toContain(REVEAL_COPY.sealedTitle);
    // The opening date, formatted in UTC, filled into the still-sealed body.
    expect(html).toContain("5 November 2024");
  });

  it('shows "Try again" once the countdown has reached zero', () => {
    // StillSealed seeds now to opensAt on the first frame; for a past opening
    // instant that frame is at zero, so the retry control renders.
    expect(html).toContain(REVEAL_COPY.sealedRetry);
  });

  it("reveals nothing about the sealed contents (R7.2)", () => {
    const lower = html.toLowerCase();
    // None of the sealed-payload markers may appear in a still-sealed scene.
    const payloadStrings = [
      "letter text",
      "usd per gallon",
      "u.s. eia",
      "3.412",
      "self-reported",
      "format_version",
      "ciphertext",
      // No recall step, no reveal stage has started yet.
      REVEAL_COPY.recallTitle.toLowerCase(),
      REVEAL_COPY.stage1Title.toLowerCase(),
      REVEAL_COPY.stage2Title.toLowerCase(),
      REVEAL_COPY.sealIntact.toLowerCase(),
    ];
    for (const needle of payloadStrings) {
      expect(
        lower,
        `sealed scene must not contain "${needle}"`,
      ).not.toContain(needle);
    }
  });
});

describe("EnvelopeView — every scene draws the envelope at the resting geometry (R8.7)", () => {
  const variants: readonly EnvelopeViewVariant[] = [
    "loading",
    "openable",
    "verifying",
    "sealed",
  ] as const;

  it("sets the frame width and top offset to the resting geometry", () => {
    for (const variant of variants) {
      const html = render({ variant, persona: PERSONA });
      // The resting geometry literals appear in the rendered inline style, so
      // the frame matches the /demo camera move's last frame.
      expect(
        html,
        `variant ${variant} must set the resting width min(84vw, 26rem)`,
      ).toContain(RESTING_WIDTH);
      expect(
        html,
        `variant ${variant} must set the resting top max(6rem, 14vh)`,
      ).toContain(RESTING_TOP);
    }
  });
});

describe("EnvelopeView — no persona means the default pattern and no dates (spec 03 renders)", () => {
  it("draws the envelope and shows no persona dates when no persona is given", () => {
    for (const variant of ["loading", "openable", "verifying"] as const) {
      const html = render({ variant });
      expect(html).toContain(ENVELOPE_LABEL);
      // No persona list fields => no dates on the front.
      expect(html).not.toContain("Written as of");
      expect(html).not.toContain("Opens ");
      // The demo note is a persona field too.
      expect(html).not.toContain("Prepared later as a demo.");
    }
  });

  it("shows no still-sealed panel for sealed with no persona (no opening date to show)", () => {
    const html = render({ variant: "sealed" });
    // With no persona there is no opening date, so the closed envelope stands
    // alone and the StillSealed panel is not rendered.
    expect(html).toContain(ENVELOPE_LABEL);
    expect(html).not.toContain(REVEAL_COPY.sealedTitle);
    expect(html).not.toContain(REVEAL_COPY.sealedRetry);
  });
});
