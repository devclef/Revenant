// The then figures in a persona's sealed payload match the Figure_File exactly
// (spec persona sealing, task 3).
//
// For every tracked metric of every persona that tracks metrics, this builds the
// payload with buildPersonaPayload and compares each payload figure to the entry
// in the Figure_File (src/lib/figures/real/fuel-figures.json). The expected entry
// is picked here directly from the JSON file, not through thenAndNow, so the test
// does not reuse the code it is checking. Each payload period must also be on or
// before the persona's written_as_of.

import { describe, expect, it } from "vitest";

import realFile from "@/lib/figures/real/fuel-figures.json";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { PERSONAS } from "@/lib/personas";

import { buildPersonaPayload } from "../../../scripts/seal-personas-core";

type FileFigure = {
  metric_id: string;
  value: string;
  unit: string;
  region: string;
  period: string;
  source: string;
  series_id: string;
  source_url: string;
  retrieved_at: string;
};

const FILE_FIGURES = realFile.figures as FileFigure[];

const PICKED = [
  "value",
  "unit",
  "region",
  "period",
  "source",
  "series_id",
  "source_url",
  "retrieved_at",
] as const;

function pick<T extends object>(figure: T): Record<string, unknown> {
  const record = figure as unknown as Record<string, unknown>;
  return Object.fromEntries(PICKED.map((key) => [key, record[key]]));
}

// The Figure_File entry for a metric's "then" figure: the one with the latest
// period on or before the lookup date. Throws if the file has no such entry, or
// if two entries share that period, so the expected value is never ambiguous.
function thenFigureFromFile(metricId: string, asOf: string): FileFigure {
  const candidates = FILE_FIGURES.filter(
    (f) => f.metric_id === metricId && f.period <= asOf,
  );
  const latest = candidates.reduce<string | null>(
    (best, f) => (best === null || f.period > best ? f.period : best),
    null,
  );
  if (latest === null) {
    throw new Error(`no Figure_File entry for ${metricId} on or before ${asOf}`);
  }
  const matches = candidates.filter((f) => f.period === latest);
  if (matches.length !== 1) {
    throw new Error(`ambiguous Figure_File entries for ${metricId} at ${latest}`);
  }
  return matches[0];
}

const PERSONAS_WITH_METRICS = PERSONAS.filter((p) => p.metrics.length > 0);

// The figures do not depend on the letter body, but the payload schema needs a
// non-empty letter_text.
const LETTER_TEXT = "A letter used only to check the then figures.";

describe("persona payload then figures match the Figure_File", () => {
  it("covers the four then figures of the fuel personas", () => {
    const metricCount = PERSONAS_WITH_METRICS.reduce(
      (sum, p) => sum + p.metrics.length,
      0,
    );
    expect(metricCount).toBe(4);
  });

  for (const persona of PERSONAS_WITH_METRICS) {
    it(`${persona.key}: each then figure equals its Figure_File entry`, () => {
      const built = buildPersonaPayload(persona, LETTER_TEXT, DEMO_FIGURES);
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      const expected = persona.metrics.map((m) =>
        pick(thenFigureFromFile(m.metric_id, persona.written_as_of)),
      );
      const actual = built.payload.figures.map((f) => pick(f));

      expect(actual).toHaveLength(persona.metrics.length);
      expect(actual).toEqual(expected);
    });

    it(`${persona.key}: each then period is on or before written_as_of`, () => {
      const built = buildPersonaPayload(persona, LETTER_TEXT, DEMO_FIGURES);
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      for (const figure of built.payload.figures) {
        expect(figure.period <= persona.written_as_of).toBe(true);
      }
    });
  }
});
