import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { figureLabel, type LetterKind } from "./FigureLine";
import { REVEAL_COPY } from "./copy";
import type { FigureV1 } from "@/lib/seal-format";
import { formatShortDate } from "@/components/ui/letter-date";

// Property 13: the now label follows the letter kind.
// For an official, non-fixture now figure, a persona letter reads "historical
// record, retrieved {date}" and a live or real letter reads "retrieved {date}".
// Fixture and self-reported figures keep their own labels for every kind.

const kindArb = fc.constantFrom<LetterKind>("persona", "live", "real");

const officialArb = fc
  .record({
    day: fc.integer({ min: 1, max: 28 }),
    month: fc.integer({ min: 1, max: 12 }),
    year: fc.integer({ min: 2020, max: 2026 }),
    hour: fc.integer({ min: 0, max: 23 }),
  })
  .map(
    ({ day, month, year, hour }): Readonly<FigureV1> => {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const hh = String(hour).padStart(2, "0");
      return {
        kind: "official",
        metric_id: "fuel",
        value: "3.412",
        unit: "USD per gallon",
        region: "U.S. city average",
        period: `${year}-${mm}`,
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
        retrieved_at: `${year}-${mm}-${dd}T${hh}:30:00Z`,
        source_url: "https://www.eia.gov/series",
      };
    },
  );

describe("Property 13: the now label follows the letter kind (R13.1, R13.2)", () => {
  it("reads historical record for a persona now figure and retrieved otherwise", () => {
    fc.assert(
      fc.property(officialArb, kindArb, (figure, kind) => {
        const label = figureLabel(figure, "now", kind);
        const date = formatShortDate(figure.retrieved_at);
        if (kind === "persona") {
          expect(label).toBe(REVEAL_COPY.labelHistoricalRecord.replace("{date}", date));
        } else {
          expect(label).toBe(REVEAL_COPY.labelRetrieved.replace("{date}", date));
          expect(label).not.toContain("historical record");
        }
      }),
    );
  });

  it("keeps the fixture and self-reported labels whatever the letter kind", () => {
    fc.assert(
      fc.property(officialArb, kindArb, (figure, kind) => {
        const fixture = { ...figure, source: "FIXTURE demo", series_id: "FIXTURE_X" } as Readonly<FigureV1>;
        expect(figureLabel(fixture, "now", kind)).toBe(REVEAL_COPY.labelFixtureData);
        const self = { ...figure, kind: "self-reported", series_id: "self" } as unknown as Readonly<FigureV1>;
        expect(figureLabel(self, "now", kind)).toBe(REVEAL_COPY.labelSelfReported);
      }),
    );
  });
});
