import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Reveal, type RevealProps } from "./Reveal";
import { REVEAL_COPY } from "./copy";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import type { Opened } from "./opening-machine";
import type { OpenedPayload } from "@/components/reveal/opened-payload";
import type { RecallRecordV2 } from "@/lib/recall";
import { PERSONAS } from "@/lib/personas";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import type {
  FigureV1,
  MetricDefinitionV1,
  PayloadV1,
} from "@/lib/seal-format";
import { figuresResponseFrom } from "./figures-stub";

/**
 * The reader's side on every reveal stage with figures: the fuel personas, a real
 * letter and a live letter (spec 16, task 6). Nothing shown on the break, Read or
 * Receipts may say "Your answer", on screen or to a screen reader. The Priya text
 * persona is covered in remembered-phrase.test.tsx.
 *
 * Figures come from the committed DEMO_FIGURES file through `personaNow`, so
 * the reveal makes no request.
 */

const STAGES = [1, 2, 3] as const;
const PERSONA_NOW = figuresResponseFrom(DEMO_FIGURES);

/** The opening instant of one persona, read from the Persona_List. */
function personaOpensAt(key: string): string {
  const persona = PERSONAS.find((p) => p.key === key);
  if (persona === undefined) {
    throw new Error(`test setup: no ${key} in the Persona_List`);
  }
  return persona.opens_at;
}
const US_OPENS_AT = personaOpensAt("us-maya");

const RECORD: RecallRecordV2 = { version: 2, answers: [] };

function metricFor(metricId: string): MetricDefinitionV1 {
  const series = CATALOGUE.find((s) => s.metric.id === metricId);
  if (series === undefined) {
    throw new Error(`test setup: no catalogue series for ${metricId}`);
  }
  return series.metric;
}

function openedWithFigures(
  letterId: string,
  writtenAsOf: string,
  opensAt: string,
  metricIds: readonly string[],
): Opened {
  const metrics = metricIds.map(metricFor);
  const figures: FigureV1[] = metricIds.map((metricId) => {
    const { then } = thenAndNow(metricId, writtenAsOf, DEMO_FIGURES);
    if (!then.found) {
      throw new Error(`test setup: no then figure for ${metricId}`);
    }
    return then.figure;
  });
  const payload = {
    format_version: 1,
    letter_text: "A short letter about the week.",
    written_as_of: writtenAsOf,
    metrics,
    figures,
    recall_questions: [],
  } satisfies PayloadV1;
  return {
    letterId,
    header: { sealedAt: `${writtenAsOf}T00:00:00.000Z`, opensAt },
    openingKey: {} as unknown as CryptoKey,
    envelopeHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    payload: payload as unknown as OpenedPayload,
  };
}

function openedNoFigures(letterId: string): Opened {
  const payload: OpenedPayload = {
    letter_text: "A short letter with no figures in it.",
    metrics: [],
    figures: [],
    recall_questions: [],
  } satisfies OpenedPayload;
  return {
    letterId,
    header: {
      sealedAt: "2024-10-01T00:00:00.000Z",
      opensAt: US_OPENS_AT,
    },
    openingKey: {} as unknown as CryptoKey,
    envelopeHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    payload,
  };
}

function renderAt(
  stage: (typeof STAGES)[number],
  extra: Partial<RevealProps>,
): string {
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(
          LiveRegionProvider,
          null,
          createElement(
            LocalViewProvider,
            null,
            createElement(Reveal, {
              opened: openedNoFigures("letter-stages"),
              record: RECORD,
              stage,
              onAdvance: () => {},
              onShowAll: () => {},
              phone: false,
              ...extra,
            } as RevealProps),
          ),
        ),
      ),
    ),
  );
}

/** Each figure persona in the committed persona list, with its figure metrics. */
const FIGURE_PERSONAS = PERSONAS.filter((p) => p.metrics.length > 0);

describe("the Remembered_Phrase on figure stages (spec 16, task 6)", () => {
  it("has at least one fuel persona to check", () => {
    expect(FIGURE_PERSONAS.length).toBeGreaterThan(0);
  });

  for (const persona of FIGURE_PERSONAS) {
    describe(`fuel persona ${persona.key}`, () => {
      const opened = openedWithFigures(
        persona.letter_id,
        persona.written_as_of,
        persona.opens_at,
        persona.metrics.map((m) => m.metric_id),
      );
      for (const stage of STAGES) {
        it(`shows no "Your answer" at stage ${stage}`, () => {
          const html = renderAt(stage, {
            opened,
            personaName: "Test",
            personaNow: PERSONA_NOW,
            close: { kind: "persona", personaKey: persona.key, demo2On: false },
          });
          expect(html, `stage ${stage}`).not.toContain(
            REVEAL_COPY.answerSpokenPrefix,
          );
          expect(html, `stage ${stage}`).not.toContain("Your answer");
        });
      }

      it("draws the Remembered_Phrase on the receipts, so the check above is not empty", () => {
        const html = renderAt(3, {
          opened,
          personaName: "Test",
          personaNow: PERSONA_NOW,
          close: { kind: "persona", personaKey: persona.key, demo2On: false },
        });
        expect(html).toContain(REVEAL_COPY.yourAnswer);
      });
    });
  }
});

describe("the Remembered_Phrase on a real letter and a live letter (spec 16, task 6)", () => {
  for (const stage of STAGES) {
    it(`shows no "Your answer" on a real letter at stage ${stage}`, () => {
      const html = renderAt(stage, {
        opened: openedNoFigures("letter-real"),
        close: { kind: "real" },
      });
      expect(html, `stage ${stage}`).not.toContain("Your answer");
    });

    it(`shows no "Your answer" on a live letter with figures at stage ${stage}`, () => {
      const html = renderAt(stage, {
        opened: openedWithFigures(
          "letter-live",
          "2024-10-01",
          US_OPENS_AT,
          FIGURE_PERSONAS[0]?.metrics.map((m) => m.metric_id) ?? [],
        ),
        personaNow: PERSONA_NOW,
        close: { kind: "live" },
      });
      expect(html, `stage ${stage}`).not.toContain("Your answer");
    });
  }
});

describe("the Text_Persona Priya on every reveal stage (spec 16, task 6)", () => {
  const PRIYA_QUESTION = "What was the first thing on your mind that autumn?";
  const priyaOpened: Opened = {
    letterId: "letter-priya",
    header: {
      sealedAt: "2024-10-01T00:00:00.000Z",
      opensAt: personaOpensAt("us-priya"),
    },
    openingKey: {} as unknown as CryptoKey,
    envelopeHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    payload: {
      letter_text: "A short letter with no figures in it.",
      metrics: [],
      figures: [],
      recall_questions: [
        { id: "q-first", answer_type: "text", text: PRIYA_QUESTION },
      ],
    } satisfies OpenedPayload,
  };
  const priyaTestimony = [
    { question: PRIYA_QUESTION, answer: "The commute, mostly." },
  ];

  for (const stage of STAGES) {
    it(`shows "She remembered · fictional" and no "Your answer" at stage ${stage}`, () => {
      const html = renderAt(stage, {
        opened: priyaOpened,
        personaName: "Priya",
        testimony: priyaTestimony,
        close: { kind: "persona", personaKey: "text-priya", demo2On: false },
      });
      expect(html, `stage ${stage}`).not.toContain("Your answer");
      expect(html, `stage ${stage}`).not.toContain(REVEAL_COPY.yourAnswer);
      if (stage === 3) {
        expect(html).toContain("She remembered · fictional");
      }
    });
  }
});
