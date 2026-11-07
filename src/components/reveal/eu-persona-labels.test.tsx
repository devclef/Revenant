import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SealedLetter } from "./SealedLetter";
import { FigureRow } from "./ReceiptCard";
import { receiptFigureOf, type LetterKind } from "./FigureLine";
import { RecallScale } from "@/components/ceremony/recall/RecallScale";
import { scaleRangeFor } from "@/components/ceremony/recall/unit-ranges";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { RecallPager, type RecallPagerProps } from "@/components/ceremony/recall/RecallPager";
import { REVEAL_COPY } from "./copy";
import type { Opened } from "./opening-machine";
import {
  formatCalendarDate,
  formatLetterDate,
} from "@/components/ui/letter-date";
import { formatPeriod } from "@/lib/figures";
import type { FigureV1, PayloadV1 } from "@/lib/seal-format";

/** One figure's Then or Now row, drawn the way FiguresThenNow draws it. */
function FigureLine({
  figure,
  role,
  letterKind,
}: {
  figure: Readonly<FigureV1>;
  role: "then" | "now";
  letterKind: LetterKind;
}) {
  return (
    <FigureRow role={role} figure={receiptFigureOf(figure, role, letterKind)} />
  );
}

/**
 * Labels for the EU persona (Tomás) on `/demo/personas/eu-tomas`, the copy
 * that makes a demo letter read as a demo (spec 08 task 5, data-integrity.md
 * "Demo mode", neutrality.md "Demo persona letters").
 *
 * Checks, on the EU persona's own dates and units:
 * - each "then" figure reads "historical record, retrieved {date}", with its
 *   period, unit and region shown next to it;
 * - the letter says it was written as of its date and prepared later as a
 *   demo;
 * - the page never gives the persona's dates as a sealed-on date. The "Sealed
 *   for the demo on" line uses the envelope header's real seal time, not the
 *   written-as-of date or the opening date.
 */

const PERSONA_NAME = "Tomás";
const WRITTEN_AS_OF = "2024-05-12";
const OPENS_AT_DATE = "2024-06-09";
// The header's seal instant is the real seal run time, not a persona date.
const SEALED_AT = "2026-11-06T10:00:00.000Z";

const LETTER_TEXT = "A short letter about the week ahead.";

const PAYLOAD = {
  format_version: 1,
  letter_text: LETTER_TEXT,
  written_as_of: WRITTEN_AS_OF,
  metrics: [
    {
      id: "eu-petrol-euro95",
      display_name: "Unleaded petrol (Euro-95)",
      unit: "EUR per 1,000 litres",
      region: "European Union",
      source: "European Commission Weekly Oil Bulletin",
      series_id: "PRE_EU_EURO95",
    },
  ],
  figures: [
    {
      kind: "official",
      metric_id: "eu-petrol-euro95",
      value: "1812.5",
      unit: "EUR per 1,000 litres",
      region: "European Union",
      period: "2024-05",
      source: "European Commission Weekly Oil Bulletin",
      series_id: "PRE_EU_EURO95",
      retrieved_at: "2024-05-20T09:00:00Z",
      source_url: "https://energy.ec.europa.eu/data/energy-prices_en",
    },
  ],
  recall_questions: [
    {
      id: "q-petrol",
      answer_type: "number",
      text: "What do you think a litre of unleaded petrol cost then?",
      metric_id: "eu-petrol-euro95",
    },
  ],
} satisfies PayloadV1;

const OPENED: Opened = {
  letterId: "eu-tomas-test",
  header: { sealedAt: SEALED_AT, opensAt: `${OPENS_AT_DATE}T00:00:00.000Z` },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: PAYLOAD,
};

const THEN_FIGURE = PAYLOAD.figures[0] as FigureV1;

describe("EU persona letter header (stage 2)", () => {
  const html = renderToStaticMarkup(
    createElement(SealedLetter, { opened: OPENED, personaName: PERSONA_NAME }),
  );

  it("says the letter was written as of its date", () => {
    expect(html).toContain(
      REVEAL_COPY.writtenAsOfPrefix.replace(
        "{date}",
        formatCalendarDate(WRITTEN_AS_OF),
      ),
    );
  });

  it("says the letter was prepared later as a demo, naming the persona", () => {
    expect(html).toContain(
      REVEAL_COPY.demoLetterLabel.replace("{name}", PERSONA_NAME),
    );
    expect(html).toContain("prepared later");
  });

  it("dates the seal from the header's real seal time, not a persona date", () => {
    expect(html).toContain(
      REVEAL_COPY.sealedForDemoOn.replace(
        "{sealedAt}",
        formatLetterDate(SEALED_AT, { kind: "utc" }),
      ),
    );
  });

  it("never says the letter was sealed on a persona date", () => {
    expect(html.toLowerCase()).not.toContain("sealed on");
    expect(html).not.toContain(formatCalendarDate(OPENS_AT_DATE));
    expect(html).not.toContain(
      `Sealed for the demo on ${formatCalendarDate(WRITTEN_AS_OF)}`,
    );
  });
});

describe("EU persona figure label (stage 3)", () => {
  it("reads 'historical record, retrieved {date}' for the then figure", () => {
    const html = renderToStaticMarkup(
      createElement(FigureLine, {
        figure: THEN_FIGURE,
        role: "then",
        letterKind: "persona",
      }),
    );
    expect(html).toContain(
      REVEAL_COPY.labelHistoricalRecord.replace(
        "{date}",
        formatLetterDate("2024-05-20T09:00:00Z", { kind: "utc" }),
      ),
    );
  });

  it("shows the period, unit and region next to the figure", () => {
    const html = renderToStaticMarkup(
      createElement(FigureLine, {
        figure: THEN_FIGURE,
        role: "then",
        letterKind: "persona",
      }),
    );
    expect(html).toContain(formatPeriod("2024-05", "European Union"));
    expect(html).toContain("EUR per 1,000 litres");
    expect(html).toContain("European Union");
  });

  it("never uses the sealed-with-letter label for a persona then figure", () => {
    const html = renderToStaticMarkup(
      createElement(FigureLine, {
        figure: THEN_FIGURE,
        role: "then",
        letterKind: "persona",
      }),
    );
    expect(html).not.toContain(REVEAL_COPY.labelSealedWithLetter.split("{")[0]);
  });
});

describe("EU persona recall scale (recall step)", () => {
  it("draws the 0 to 3,000 scale for the EUR per 1,000 litres unit", () => {
    const html = renderToStaticMarkup(
      createElement(RecallScale, {
        id: "q-petrol",
        label: "What do you think a litre of unleaded petrol cost then?",
        unitLabel: "EUR per 1,000 litres",
        range: scaleRangeFor("EUR per 1,000 litres"),
        value: null,
        noAnswer: false,
        onEdit: () => {},
      }),
    );
    expect(html).toContain("3,000");
    expect(html).toContain(">0<");
  });
});

describe("EU persona recall question (Unit_Helper_Line)", () => {
  it("shows the Unit_Helper_Line under the EUR per 1,000 litres question", () => {
    const props: RecallPagerProps = {
      payload: {
        metrics: [
          { id: "eu-petrol-euro95", unit: "EUR per 1,000 litres" } as unknown as PayloadV1["metrics"][number],
        ],
        recall_questions: [PAYLOAD.recall_questions[0]],
      },
      drafts: { "q-petrol": { text: "1200", noAnswer: false } },
      invalid: [],
      submitting: false,
      onEdit: () => undefined,
      onToggleNoAnswer: () => undefined,
      onSubmit: () => undefined,
    };
    const html = renderToStaticMarkup(createElement(RecallPager, props));
    expect(html).toContain(CEREMONY_COPY.unitHelperEurPer1000L);
    expect(html).toMatch(/aria-describedby="[^"]*recall-q-petrol-unit-help/);
  });
});
