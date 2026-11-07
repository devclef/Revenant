import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SealedLetter } from "./SealedLetter";
import { REVEAL_COPY } from "./copy";
import {
  formatCalendarDate,
  formatLetterDate,
} from "@/components/ui/letter-date";
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
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
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

  it("carries no ink marker: the letter is shown whole, never masked", () => {
    const html = render(OPENED);
    expect(html).not.toContain("data-ink-text");
  });

  it("preserves the letter's line breaks and spacing via pre-wrap", () => {
    const html = render(OPENED);
    // The newlines and the double spaces survive into the markup untouched.
    expect(html).toContain("first line.\nSecond line, after a break.\n\nA  double  space");
  });

  it("shows the Letter_Disclosure line with the persona name and written-as-of date (C6.1)", () => {
    const html = render(OPENED);
    expect(html).toContain(
      REVEAL_COPY.letterDisclosure
        .replace("{name}", PERSONA_NAME)
        .replace("{writtenAsOf}", formatCalendarDate("2024-10-15")),
    );
    expect(html).toContain("data-persona-disclosure");
  });

  it("omits the disclosure line when the payload has no written_as_of", () => {
    const payloadNoAsOf: PayloadV1 = {
      format_version: PAYLOAD.format_version,
      letter_text: PAYLOAD.letter_text,
      metrics: PAYLOAD.metrics,
      figures: PAYLOAD.figures,
      recall_questions: PAYLOAD.recall_questions,
    };
    const openedNoAsOf: Opened = { ...OPENED, payload: payloadNoAsOf };
    const html = render(openedNoAsOf);
    expect(html).not.toContain("data-persona-disclosure");
    expect(html).not.toContain("is fictional.");
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

  it("always shows the disclosure with the persona name, as a fictional persona (R10.3, C6.1)", () => {
    const html = render(OPENED);
    expect(html).toContain(
      REVEAL_COPY.letterDisclosure
        .replace("{name}", PERSONA_NAME)
        .replace("{writtenAsOf}", formatCalendarDate("2024-10-15")),
    );
  });

  it('shows "Sealed for this demo on {sealedAt}" derived from the header (R10.4, C6.3)', () => {
    const html = render(OPENED);
    expect(html).toContain(
      REVEAL_COPY.sealedForThisDemo.replace(
        "{sealedAt}",
        formatLetterDate(OPENED.header.sealedAt, { kind: "utc" }),
      ),
    );
    // The seal date comes from the header, never the opening date.
    expect(html).not.toContain(
      formatLetterDate(OPENED.header.opensAt, { kind: "utc" }),
    );
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

describe("SealedLetter collapsible letter (P6, P7)", () => {
  function renderCollapsible(opened: Opened): string {
    return renderToStaticMarkup(
      createElement(SealedLetter, {
        opened,
        personaName: PERSONA_NAME,
        collapsible: true,
      }),
    );
  }

  it("puts the letter text in a closed disclosure when collapsible", () => {
    const markup = renderCollapsible(OPENED);
    expect(markup).toMatch(/<details[^>]*data-letter-disclosure=""/);
    expect(markup).toContain(`<summary>${REVEAL_COPY.letterDisclosureSummary}</summary>`);
    expect(markup).not.toMatch(/<details[^>]* open/);
    expect(markup).toContain("data-letter-text");
    expect(markup).toContain("LETTER_BODY_SECRET");
  });

  it("leaves the letter text unwrapped by default", () => {
    const markup = render(OPENED);
    expect(markup).not.toContain("data-letter-disclosure");
    expect(markup).toContain("data-letter-text");
  });
});

describe("stage 2 letter sits on StagePanel's paper panel (WCAG AA)", () => {
  it("leaves the paper and ink to StagePanel, so the section sets no background or colour", () => {
    const css = readFileSync(join(__dirname, "reveal.module.css"), "utf8");
    expect(css).not.toMatch(/\.sealedLetter\s*\{[^}]*background-color:/);
    expect(css).not.toMatch(/\.sealedLetter\s*\{[^}]*color:/);
  });
});
