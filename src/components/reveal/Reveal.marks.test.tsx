import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Reveal, type RevealProps } from "./Reveal";
import { REVEAL_COPY } from "./copy";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { WaxSeal } from "@/components/ceremony/envelope/WaxSeal";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import type { Opened } from "./opening-machine";
import type { RecallRecordV1 } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * The marks stage (stage 1 of the reveal) shows each number answer on a
 * read-only recall scale, with the Mark at the value the judge recorded. Built
 * with `renderToStaticMarkup`, like the other reveal markup tests.
 */

const OPENED: Opened = {
  letterId: "letter-marks",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  payload: {
    format_version: 1,
    letter_text: "A short letter for the marks test.",
    metrics: [
      {
        id: "fuel",
        display_name: "Regular gasoline",
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
      },
      {
        id: "milk",
        display_name: "Milk",
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "U.S. BLS",
        series_id: "APU0000709112",
      },
    ],
    figures: [],
    recall_questions: [
      {
        id: "q-fuel",
        answer_type: "number",
        text: "What do you think a gallon of regular gasoline cost then?",
        metric_id: "fuel",
      },
      {
        id: "q-milk",
        answer_type: "number",
        text: "What do you think a gallon of milk cost then?",
        metric_id: "milk",
      },
      {
        id: "q-note",
        answer_type: "text",
        text: "What were you spending most on then?",
      },
    ],
  } satisfies PayloadV1,
};

function renderMarks(
  record: RecallRecordV1,
  extra: Partial<RevealProps> = {},
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
              opened: OPENED,
              record,
              personaName: "Maya",
              stage: 1,
              onAdvance: () => {},
              onShowAll: () => {},
              ...extra,
            }),
          ),
        ),
      ),
    ),
  );
}

describe("reveal marks stage: read-only recall scales", () => {
  const RECORD: RecallRecordV1 = {
    version: 1,
    answers: [
      { question_id: "q-fuel", kind: "number", value: "2.50" },
      { question_id: "q-milk", kind: "no_answer" },
      { question_id: "q-note", kind: "no_answer" },
    ],
  };

  it("renders one read-only slider per number question, and none for the text question", () => {
    const html = renderMarks(RECORD);
    const sliders = html.match(/role="slider"/g) ?? [];
    expect(sliders).toHaveLength(2);
    expect(html.match(/aria-readonly="true"/g) ?? []).toHaveLength(2);
    expect(html.match(/tabindex="-1"/g) ?? []).toHaveLength(2);
  });

  it("places the Mark at the recorded value and says 'Your answer' with the unit", () => {
    const html = renderMarks(RECORD);
    expect(html).toContain(
      `aria-valuetext="${REVEAL_COPY.yourAnswer}: 2.5 USD per gallon"`,
    );
    expect(html).toContain('data-readout="readout">2.5<');
  });

  it("shows no Mark for a question recorded as no answer, and it stays disabled", () => {
    const html = renderMarks(RECORD);
    expect(html).toContain(`aria-valuetext="${CEREMONY_COPY.recallNoMarkYet}"`);
    expect(html).toContain('aria-disabled="true"');
    // Only the answered question carries a readout.
    expect(html.match(/data-readout="readout"/g) ?? []).toHaveLength(1);
  });

  it("keeps the existing 'Your answer' text list next to the scales", () => {
    const html = renderMarks(RECORD);
    expect(html).toContain(`${REVEAL_COPY.yourAnswer}: 2.50`);
  });
});

/**
 * The seal body for one pattern key: everything from the `width` attribute on,
 * so the class list `SealBreak` adds does not hide the pattern being compared.
 */
function sealMarkup(patternKey: string): string {
  const markup = renderToStaticMarkup(
    createElement(WaxSeal, { patternKey, size: 64 }),
  );
  return markup.slice(markup.indexOf("width="));
}

describe("reveal seal pattern key (spec 06, R18.2)", () => {
  const RECORD: RecallRecordV1 = {
    version: 1,
    answers: [],
  };
  const LIVE_LETTER_ID = "live-letter-seal-key";

  it("draws the one seal for a live letter, the same as for a persona (R10.10)", () => {
    const html = renderMarks(RECORD, {
      variant: "live",
      letterId: LIVE_LETTER_ID,
    });
    expect(html).toContain(sealMarkup(LIVE_LETTER_ID));
    expect(html).toContain(sealMarkup("Maya"));
  });

  it("keeps the one seal when the variant is persona (R10.10)", () => {
    const html = renderMarks(RECORD, { letterId: LIVE_LETTER_ID });
    expect(html).toContain(sealMarkup("Maya"));
    expect(html).toContain(sealMarkup(LIVE_LETTER_ID));
  });
});
