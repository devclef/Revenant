import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SealedLetter } from "./SealedLetter";
import { REVEAL_COPY } from "./copy";
import { formatCalendarDate, formatUtcDate } from "@/components/demo/dates";
import type { Opened } from "./opening-machine";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * Markup tests for stage 2 of the reveal (design.md "Reveal", R10.1-R10.4).
 * Rendered with `renderToStaticMarkup` and `createElement` — no DOM library
 * and no JSX, matching the existing reveal test style (RememberedAnswers).
 *
 * Property 18 (validates R10.1, R10.4): the sealed letter text is shown
 * literally. `SealedLetter` reads `payload.letter_text` straight into a
 * `<p white-space: pre-wrap>` child, so whatever bytes were sealed appear
 * verbatim in the markup, line breaks and spacing preserved, and nothing is
 * added, trimmed, reworded or summarised (neutrality.md, R15.1).
 *
 * The stage also shows, and ONLY shows:
 * - "Written as of {date}" — but only when the payload carries `written_as_of`
 *   (R10.2);
 * - the demo letter label, always (R10.3);
 * - "Sealed for the demo on {sealedAt}" derived from the envelope header
 *   (R10.4), never from the clock or the opening date.
 *
 * The fixture `Opened` mirrors the Property 17 test's PAYLOAD/OPENED so the two
 * views are checked against the same sealed shape. The letter text is written
 * with real line breaks and double spaces so pre-wrap preservation is testable.
 */

const PERSONA_NAME = "Maya";

const LETTER_TEXT =
  "LETTER_BODY_SECRET first line.\nSecond line, after a break.\n\nA  double  space  and a blank line above.";

const PAYLOAD = {
  format_version: 1,
  letter_text: LETTER_TEXT,
  written_as_of: "2024-10-15",
  metrics: [
    {
      id: "fuel",
      display_name: "Regular gasoline",
      unit: "USD per gallon",
      region: "U.S. city average",
      source: "U.S. EIA",
      series_id: "EMM_EPMR_PTE_NUS_DPG",
    },
  ],
  figures: [
    {
      kind: "official",
      metric_id: "fuel",
      value: "3.412",
      unit: "USD per gallon",
      region: "U.S. city average",
      period: "2024-10",
      source: "U.S. EIA",
      series_id: "EMM_EPMR_PTE_NUS_DPG",
      retrieved_at: "2024-10-30T14:02:11Z",
      source_url: "https://www.eia.gov/fixture",
    },
  ],
  recall_questions: [
    {
      id: "q-fuel",
      answer_type: "number",
      text: "What do you think a gallon of regular gasoline cost then?",
      metric_id: "fuel",
    },
  ],
} satisfies PayloadV1;

const OPENED: Opened = {
  letterId: "letter-1",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  payload: PAYLOAD,
};

function render(opened: Opened): string {
  return renderToStaticMarkup(
    createElement(SealedLetter, { opened, personaName: PERSONA_NAME }),
  );
}

describe("SealedLetter markup", () => {
  it("shows the stage 2 heading", () => {
    const html = render(OPENED);
    expect(html).toContain(REVEAL_COPY.stage2Title);
  });

  it("shows the letter text literally, verbatim (Property 18, R10.1, R10.4)", () => {
    const html = render(OPENED);
    // The sealed bytes appear exactly as sealed. HTML entity-encoding of the
    // text is expected in static markup, so compare against the same encoding
    // renderToStaticMarkup would produce for a bare text child.
    const encoded = renderToStaticMarkup(createElement("p", null, LETTER_TEXT));
    const inner = encoded.slice("<p>".length, -"</p>".length);
    expect(html).toContain(inner);
  });

  it("preserves the letter's line breaks and spacing via pre-wrap", () => {
    const html = render(OPENED);
    // The newlines and the double spaces survive into the markup untouched.
    expect(html).toContain("first line.\nSecond line, after a break.\n\nA  double  space");
  });

  it('shows "Written as of {date}" when written_as_of is present (R10.2)', () => {
    const html = render(OPENED);
    expect(html).toContain(
      REVEAL_COPY.writtenAsOfPrefix.replace(
        "{date}",
        formatCalendarDate("2024-10-15"),
      ),
    );
  });

  it("omits the written-as-of line when the payload has no written_as_of", () => {
    const payloadNoAsOf: PayloadV1 = {
      format_version: PAYLOAD.format_version,
      letter_text: PAYLOAD.letter_text,
      metrics: PAYLOAD.metrics,
      figures: PAYLOAD.figures,
      recall_questions: PAYLOAD.recall_questions,
    };
    const openedNoAsOf: Opened = { ...OPENED, payload: payloadNoAsOf };
    const html = render(openedNoAsOf);
    // The prefix word never appears with no date behind it.
    expect(html).not.toContain("Written as of");
  });

  it("always shows the demo letter label with the persona name (R10.3)", () => {
    const html = render(OPENED);
    expect(html).toContain(
      REVEAL_COPY.demoLetterLabel.replace("{name}", PERSONA_NAME),
    );
  });

  it('shows "Sealed for the demo on {sealedAt}" derived from the header (R10.4)', () => {
    const html = render(OPENED);
    expect(html).toContain(
      REVEAL_COPY.sealedForDemoOn.replace(
        "{sealedAt}",
        formatUtcDate(OPENED.header.sealedAt),
      ),
    );
    // The seal date comes from the header, never the opening date.
    expect(html).not.toContain(formatUtcDate(OPENED.header.opensAt));
  });

  it("adds no commentary beyond the four stage-2 elements", () => {
    const html = render(OPENED);
    // Nothing from stage 3 (the figures) leaks into stage 2: no figure value,
    // period, source, series, url, change or fixture note.
    const forbidden = [
      "3.412",
      "2024-10",
      "U.S. EIA",
      "EMM_EPMR_PTE_NUS_DPG",
      "https://www.eia.gov/fixture",
      REVEAL_COPY.stage3Title,
      REVEAL_COPY.fixtureNote,
      REVEAL_COPY.then,
      REVEAL_COPY.now,
      "%",
    ];
    for (const needle of forbidden) {
      expect(html, `stage 2 must not render "${needle}"`).not.toContain(needle);
    }
  });
});
