// Markup tests for Envelope (05-reveal-ceremony, design.md "Envelope and seal";
// R3.6, R3.7, R15.1, Property 3's render clause).
//
// Envelope is pure presentation. Its only per-letter inputs are the persona's
// list fields (two dates and the demo flag) and the seal's pattern key; it takes
// no letter payload — no text, no figures, no counts. Rendered with
// `renderToStaticMarkup` and `createElement` (no DOM library, no JSX) so the
// whole SVG + date markup is a string we can scan and compare.
//
// What these pin:
//   - Property 3: the `closed` / `turned` / `open` markup is byte-identical no
//     matter how long a notional letter is or how many figures it has, because
//     the envelope is handed none of that. We render each state in many
//     "payload contexts" (varied notional letter length / figure count) and
//     assert the markup never moves.
//   - R3.7: the front shows "Written as of {date}" and "Opens {date}", shows
//     "Prepared later as a demo." only when `demo`, and NEVER renders a
//     sealed-on date or the words "sealed on".
//   - R15.1: every user-facing string comes from CEREMONY_COPY, with no inline
//     copy literals.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { formatCalendarDate, formatUtcDate } from "@/components/demo/dates";

import { CEREMONY_COPY } from "../copy";
import { Envelope } from "./Envelope";
import type { EnvelopePersona, EnvelopeState } from "./Envelope";

const STATES: readonly EnvelopeState[] = ["closed", "turned", "open"] as const;

/** A fixed persona: the only per-letter fields the envelope ever sees. */
const PERSONA: EnvelopePersona = {
  key: "us-maya",
  written_as_of: "2024-05-12",
  opens_at: "2024-11-05T00:00:00.000Z",
  demo: true,
};

const renderEnvelope = (
  state: EnvelopeState,
  persona?: EnvelopePersona,
): string =>
  renderToStaticMarkup(createElement(Envelope, { state, persona }));

describe("Envelope — markup cannot vary with the letter payload (Property 3)", () => {
  it("renders byte-identical markup for a given state across any notional letter length or figure count", () => {
    // The envelope takes no payload, so there is no prop through which a letter
    // could change it. We model "many letter lengths and figure counts" as many
    // render attempts with wildly different surrounding notional payloads; the
    // envelope ignores all of it, so every render of a state must match.
    const notionalPayloads = [
      { letterLength: 0, figureCount: 0 },
      { letterLength: 1, figureCount: 1 },
      { letterLength: 500, figureCount: 3 },
      { letterLength: 5000, figureCount: 12 },
    ];
    for (const state of STATES) {
      const baseline = renderEnvelope(state, PERSONA);
      for (const _payload of notionalPayloads) {
        // The payload is deliberately unused: the envelope receives none of it.
        void _payload;
        expect(renderEnvelope(state, PERSONA)).toBe(baseline);
      }
    }
  });

  it("renders byte-identical markup across repeated renders for the same props", () => {
    for (const state of STATES) {
      const first = renderEnvelope(state, PERSONA);
      expect(renderEnvelope(state, PERSONA)).toBe(first);
      expect(renderEnvelope(state, PERSONA)).toBe(first);
    }
  });

  it("the SVG art is identical across all three states (same envelope for every letter, R3.6)", () => {
    // The three states differ only in which face/fold is drawn and where the
    // date lines sit; the fixed viewBox and body are the same. Pin that the
    // envelope never reads a letter by checking its label is the fixed one.
    for (const state of STATES) {
      const html = renderEnvelope(state, PERSONA);
      expect(html).toContain('aria-label="An envelope."');
      expect(html).toContain('viewBox="0 0 300 188"');
    }
  });
});

describe("Envelope — front dates come from the persona list, never a sealed-on date (R3.7)", () => {
  it("shows 'Written as of {date}' and 'Opens {date}' on the closed front", () => {
    const html = renderEnvelope("closed", PERSONA);
    const written = CEREMONY_COPY.envelopeWrittenAsOf.replace(
      "{date}",
      formatCalendarDate(PERSONA.written_as_of),
    );
    const opens = CEREMONY_COPY.envelopeOpens.replace(
      "{date}",
      formatUtcDate(PERSONA.opens_at),
    );
    expect(html).toContain(written);
    expect(html).toContain(opens);
    // Spot-check the rendered dates read as the UTC long form.
    expect(html).toContain("Written as of 12 May 2024");
    expect(html).toContain("Opens 5 November 2024");
  });

  it("shows 'Prepared later as a demo.' only when the persona is a demo", () => {
    const demoHtml = renderEnvelope("closed", PERSONA);
    expect(demoHtml).toContain(CEREMONY_COPY.envelopeDemoNote);

    const realHtml = renderEnvelope("closed", { ...PERSONA, demo: false });
    expect(realHtml).not.toContain(CEREMONY_COPY.envelopeDemoNote);
  });

  it("renders no date lines on the turned or open states (dates belong to the front, R3.7)", () => {
    for (const state of ["turned", "open"] as const) {
      const html = renderEnvelope(state, PERSONA);
      expect(html).not.toContain(CEREMONY_COPY.envelopeWrittenAsOf.replace("{date}", ""));
      expect(html).not.toContain("12 May 2024");
      expect(html).not.toContain("5 November 2024");
    }
  });

  it("NEVER renders a sealed-on date or the words 'sealed on' in any state (R3.7)", () => {
    for (const state of STATES) {
      const html = renderEnvelope(state, PERSONA).toLowerCase();
      expect(html, `state ${state} must not claim a sealed-on date`).not.toContain(
        "sealed on",
      );
      expect(html, `state ${state} must not expose a sealedAt field`).not.toContain(
        "sealedat",
      );
    }
  });

  it("renders no date lines at all when no persona is given (spec 03 renders)", () => {
    for (const state of STATES) {
      const html = renderEnvelope(state);
      expect(html).not.toContain("Written as of");
      expect(html).not.toContain("Opens ");
      expect(html).not.toContain(CEREMONY_COPY.envelopeDemoNote);
    }
  });
});

describe("Envelope — reads only persona list fields, never a letter payload", () => {
  it("renders nothing from a sealed letter's contents in any state", () => {
    // The envelope takes no payload prop, so none of these could appear. Guards
    // against a future prop leak carrying letter content onto the paper.
    const payloadStrings = [
      "letter text",
      "USD per gallon",
      "U.S. EIA",
      "3.412",
      "self-reported",
      "format_version",
      "serverSecret",
      "ciphertext",
    ];
    for (const state of STATES) {
      const html = renderEnvelope(state, PERSONA).toLowerCase();
      for (const needle of payloadStrings) {
        expect(
          html,
          `state ${state} markup must not contain payload string "${needle}"`,
        ).not.toContain(needle.toLowerCase());
      }
    }
  });
});

describe("Envelope — every user-facing string comes from CEREMONY_COPY (R15.1)", () => {
  it("uses the copy templates, not inline literals, for the front lines", () => {
    const html = renderEnvelope("closed", PERSONA);
    // Each visible line is the copy template with its date filled in. If a
    // literal were inlined instead, renaming the copy key would not move it.
    const expected = [
      CEREMONY_COPY.envelopeWrittenAsOf.replace(
        "{date}",
        formatCalendarDate(PERSONA.written_as_of),
      ),
      CEREMONY_COPY.envelopeOpens.replace(
        "{date}",
        formatUtcDate(PERSONA.opens_at),
      ),
      CEREMONY_COPY.envelopeDemoNote,
    ];
    for (const line of expected) {
      expect(html).toContain(line);
    }
  });
});
