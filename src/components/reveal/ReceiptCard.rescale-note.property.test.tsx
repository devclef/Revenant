// Feature: 09 figure card, Property 7: One rescale note per card
//
// For any Receipt_Card branch (figure, Number_Line-free message card, and the
// Single_Figure_View), the rescale note is printed exactly once when the card
// is given one, and not at all when it is not. The note is never printed in a
// then or now row. Validates C8.4 and the one-note rule of the figure card.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { ReceiptCard, type ReceiptCardProps } from "./ReceiptCard";
import { FigureEntry } from "./FigureEntry";
import { rescaleNoteText } from "./change-display";
import { computeChange, type DisplayRescale } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

const NOTE = "Shown in EUR per litre. Published in EUR per 1,000 litres.";
const REGION = "European Union";

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const figureArb = fc.constantFrom<"figure" | "message" | "single">(
  "figure",
  "message",
  "single",
);

function cardProps(
  variant: "figure" | "message" | "single",
  rescaleNote: string | undefined,
): ReceiptCardProps {
  const then = {
    value: "1.80",
    unit: "EUR per litre",
    period: "May 2024",
    region: REGION,
    label: "historical record, retrieved 30 Oct 2026",
  };
  const base: ReceiptCardProps = {
    name: "Unleaded petrol",
    region: REGION,
    markValue: undefined,
    unit: "EUR per litre",
    then,
    now:
      variant === "message"
        ? { message: "Not available yet." }
        : { ...then, value: "1.90", period: "May 2026" },
    source: {
      source: "European Commission Weekly Oil Bulletin",
      seriesId: "EU_PRICE_WITH_TAX_EURO95",
      asPublished: "As published: 1800.00 EUR per 1,000 litres",
    },
    rescaleNote,
  };
  return variant === "single" ? { ...base, single: true } : base;
}

describe("Property 7: one rescale note per card", () => {
  it("prints the note exactly once when given, and never otherwise, on every branch", () => {
    fc.assert(
      fc.property(figureArb, fc.boolean(), (variant, withNote) => {
        const html = renderToStaticMarkup(
          createElement(
            ReceiptCard,
            cardProps(variant, withNote ? NOTE : undefined),
          ),
        );
        expect(count(html, NOTE)).toBe(withNote ? 1 : 0);
        expect(count(html, 'data-rescale-note=""')).toBe(withNote ? 1 : 0);
      }),
    );
  });
});

describe("the rescale note is built from the stored and displayed units", () => {
  it("reads Shown in <displayed>. Published in <stored>. for a rescaled unit", () => {
    expect(rescaleNoteText("EUR per 1,000 litres", "EUR per litre")).toBe(NOTE);
  });

  it("is absent when the unit is shown as sealed", () => {
    expect(rescaleNoteText("USD per gallon", "USD per gallon")).toBeUndefined();
  });
});

describe("Tomás's EUR per 1,000 litres card (C8.4)", () => {
  const rescale: DisplayRescale = { divisor: 1000, unit: "EUR per litre" };
  const THEN: Readonly<FigureV1> = {
    kind: "official",
    metric_id: "eu-petrol-euro95",
    value: "1800.00",
    unit: "EUR per 1,000 litres",
    region: REGION,
    period: "2024-05",
    source: "European Commission Weekly Oil Bulletin",
    series_id: "EU_PRICE_WITH_TAX_EURO95",
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://example.invalid/oil-bulletin",
  };
  const NOW: Readonly<FigureV1> = {
    ...THEN,
    value: "1900.00",
    period: "2026-05",
  };

  it("shows the rescale note exactly once and keeps the stored value as published", () => {
    const change = computeChange(THEN, NOW, { allowSamePeriod: false });
    if (!change.comparable) throw new Error("test setup: pair must be comparable");
    const html = renderToStaticMarkup(
      createElement(FigureEntry, {
        name: "Unleaded petrol",
        then: THEN,
        now: NOW,
        change,
        rescale,
      }),
    );
    expect(count(html, NOTE)).toBe(1);
    expect(html).toContain("As published: 1800.00 EUR per 1,000 litres");
  });
});
