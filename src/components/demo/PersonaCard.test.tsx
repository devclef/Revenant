import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PersonaCard } from "./PersonaCard";
import { DEMO_COPY } from "./copy";
import { formatCalendarDate, formatUtcDate } from "./dates";

/**
 * Markup tests for a single PersonaCard (R6.2, R6.6, R6.7). Renders with
 * `renderToStaticMarkup` and `createElement` — no DOM library and no JSX, so
 * the card's full output is just a string we can scan.
 *
 * The props here are the only fields a card may receive: the persona's list
 * fields. No sealed payload (letter text, metric figures) is ever passed in,
 * because a card never receives it (R6.6); the card is a label and a way in.
 */

/** Example list-field props. Dates are chosen to format to distinct strings. */
const PROPS = {
  personaKey: "us-maya",
  display_name: "Maya",
  region: "United States",
  written_as_of: "2024-05-12",
  opens_at: "2024-11-05T00:00:00.000Z",
} as const;

const render = () => renderToStaticMarkup(createElement(PersonaCard, PROPS));

describe("PersonaCard markup", () => {
  it("shows the display name and region", () => {
    const html = render();
    expect(html).toContain(PROPS.display_name);
    expect(html).toContain(PROPS.region);
  });

  it('shows the "Written as of" line with the date formatted via dates.ts', () => {
    const html = render();
    expect(html).toContain(DEMO_COPY.writtenAsOfPrefix);
    expect(html).toContain(formatCalendarDate(PROPS.written_as_of));
    // Sanity-check the fixture: the helper really does reshape the raw input.
    expect(formatCalendarDate(PROPS.written_as_of)).toBe("12 May 2024");
  });

  it('shows the "Opens" line with the date formatted via dates.ts', () => {
    const html = render();
    expect(html).toContain(DEMO_COPY.opensPrefix);
    expect(html).toContain(formatUtcDate(PROPS.opens_at));
    expect(formatUtcDate(PROPS.opens_at)).toBe("5 November 2024");
  });

  it('renders a "Pick up the letter" link to /demo/personas/{key}', () => {
    const html = render();
    expect(html).toContain(DEMO_COPY.openLetter);
    expect(html).toContain("Pick up the letter");
    expect(html).toContain(`href="/demo/personas/${PROPS.personaKey}"`);
  });

  it('never says "Break the seal" on the card (R2)', () => {
    // The old link copy was "Break the seal"; the seal-break moment belongs to
    // the reveal ceremony, not a persona card. The card only invites the reader
    // in, so the words must appear nowhere in its markup.
    const html = render();
    expect(html).not.toContain("Break the seal");
  });

  it("renders the raw ISO/calendar inputs nowhere — only the formatted dates", () => {
    const html = render();
    // The unformatted source values must not leak into the visible card.
    expect(html).not.toContain(PROPS.written_as_of);
    expect(html).not.toContain(PROPS.opens_at);
  });

  it("contains no sealed-payload strings — a card is list fields only (R6.6)", () => {
    const html = render().toLowerCase();
    // A card never receives the letter body, its metric figures, units,
    // sources or periods. None of these could appear because the component
    // only reads the list-field props above. Guard against a future prop leak.
    // "letter text" (not the bare word "letter", which is product vocabulary
    // used in the "Pick up the letter" link label) stands in for the sealed
    // letter body; the rest are real payload markers a card can never hold.
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
    for (const needle of payloadStrings) {
      expect(
        html,
        `card markup must not contain payload string "${needle}"`,
      ).not.toContain(needle.toLowerCase());
    }
  });
});
