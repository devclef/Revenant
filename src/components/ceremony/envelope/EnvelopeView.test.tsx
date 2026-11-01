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
//   - `verified` (intact) shows the seal-is-intact statement and a Begin
//     control, and does so with NO recall question, Mark or letter present
//     (Property 2's envelope clauses: the envelope scene precedes every later
//     Stage). The envelope stays `closed` until BEGIN; it only turns over when
//     a later Stage drives `envelopeState`.
//   - R8.7: every scene draws the envelope at ENVELOPE_TARGET — the geometry
//     literals from constants.ts appear in the rendered inline style.
//   - With no persona: the default seal pattern and no dates (spec 03 renders).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "@/components/reveal/copy";
import { ENVELOPE_TARGET } from "../constants";
import { EnvelopeView } from "./EnvelopeView";
import type {
  EnvelopeViewProps,
  EnvelopeViewVariant,
} from "./EnvelopeView";
import type { EnvelopePersona } from "./Envelope";

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
  renderToStaticMarkup(createElement(EnvelopeView, props));

/** The closed envelope's fixed SVG label — present whenever the paper is drawn. */
const ENVELOPE_LABEL = 'aria-label="An envelope."';

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

describe("EnvelopeView — verified is the intact Stage, before any recall or letter (Property 2)", () => {
  const html = render({ variant: "verified", persona: PERSONA, onBegin: () => {} });

  it("shows the seal-is-intact statement and a Begin control", () => {
    expect(html).toContain(REVEAL_COPY.sealIntact);
    expect(html).toContain(REVEAL_COPY.begin);
    expect(html).toMatch(/<button[^>]*>Begin<\/button>/);
  });

  it("precedes every later Stage: no Mark, no recall question, no letter (Property 2)", () => {
    const lower = html.toLowerCase();
    // The intact statement comes BEFORE the recall step and the reveal stages;
    // none of their copy may be present in this scene.
    const laterStageStrings = [
      REVEAL_COPY.recallTitle, // "Before you read it"
      REVEAL_COPY.recallIntro.replace("{date}", ""),
      REVEAL_COPY.submit, // the recall submit
      REVEAL_COPY.stage1Title, // "What you remembered"
      REVEAL_COPY.stage2Title, // "What was written then"
      REVEAL_COPY.stage3Title, // "The numbers, then and now"
    ];
    for (const needle of laterStageStrings) {
      expect(
        lower,
        `intact scene must not contain later-stage copy "${needle}"`,
      ).not.toContain(needle.toLowerCase());
    }
    // And no sealed letter body or figures leak onto this scene.
    for (const needle of ["letter text", "usd per gallon", "self-reported"]) {
      expect(lower).not.toContain(needle);
    }
  });

  it("holds the envelope closed until BEGIN is sent (the turn comes later)", () => {
    // With the default envelopeState the paper rests closed on the intact Stage;
    // the turn-over (closed -> turned / open) is driven by the later Stages only
    // after BEGIN (R7.5, product.md "Recall first").
    expect(html).toContain('data-envelope-state="closed"');
    expect(html).not.toContain('data-envelope-state="turned"');
    expect(html).not.toContain('data-envelope-state="open"');
  });

  it("turns the envelope over only when a later Stage drives envelopeState", () => {
    // Once BEGIN has been sent, the caller advances envelopeState; the view then
    // draws the turned face. This proves the closed-until-BEGIN hold above is a
    // real gate, not a hardcoded closed envelope.
    const turned = render({
      variant: "verified",
      persona: PERSONA,
      envelopeState: "turned",
    });
    expect(turned).toContain('data-envelope-state="turned"');
  });
});

describe("EnvelopeView — every scene draws the envelope at ENVELOPE_TARGET (R8.7)", () => {
  const variants: readonly EnvelopeViewVariant[] = [
    "loading",
    "openable",
    "verifying",
    "sealed",
    "verified",
  ] as const;

  it("sets the frame width and top offset from the constants", () => {
    for (const variant of variants) {
      const html = render({ variant, persona: PERSONA });
      // The geometry literals from constants.ts appear in the rendered inline
      // style, so the resting frame matches the /demo camera move's last frame.
      expect(
        html,
        `variant ${variant} must set the ENVELOPE_TARGET width`,
      ).toContain(ENVELOPE_TARGET.width);
      expect(
        html,
        `variant ${variant} must set the ENVELOPE_TARGET top offset`,
      ).toContain(ENVELOPE_TARGET.top);
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

  it("renders the verified scene with no dates when no persona is given", () => {
    const html = render({ variant: "verified" });
    expect(html).toContain(REVEAL_COPY.sealIntact);
    expect(html).not.toContain("Written as of");
    expect(html).not.toContain("Opens ");
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
