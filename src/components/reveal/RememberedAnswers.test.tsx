import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RememberedAnswers } from "./RememberedAnswers";
import { Reveal } from "./Reveal";
import { REVEAL_COPY } from "./copy";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import type { Opened } from "./opening-machine";
import type { RecallRecordV1 } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * Markup tests for stage 1 of the reveal (R9.2, R9.3, R3.8). Rendered with
 * `renderToStaticMarkup` and `createElement` — no DOM library and no JSX.
 *
 * Stage 1 is the ONLY stage shown before the letter. It shows, per question:
 * the question text, the figure's unit, and the judge's own answer — either the
 * decimal they recorded ("Your answer: 3.50") or "No answer". It must show
 * nothing from inside the letter: no sealed figure value, period, source or
 * comparison (R3.8).
 */

/** The same payload the recall step used, with figure provenance present so the
 * test can prove stage 1 renders none of it. */
const OPENED: Opened = {
  letterId: "letter-1",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  payload: {
    format_version: 1,
    letter_text: "LETTER_BODY_SECRET the letter text must never appear here.",
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
      {
        id: "q-note",
        answer_type: "text",
        text: "What were you spending most on then?",
      },
    ],
  } satisfies PayloadV1,
};

const RECORD: RecallRecordV1 = {
  version: 1,
  answers: [
    { question_id: "q-fuel", kind: "number", value: "2.50" },
    { question_id: "q-note", kind: "no_answer" },
  ],
};

function render(record: RecallRecordV1): string {
  return renderToStaticMarkup(
    createElement(RememberedAnswers, { opened: OPENED, record }),
  );
}

describe("RememberedAnswers markup", () => {
  it("shows the stage 1 heading", () => {
    const html = render(RECORD);
    expect(html).toContain(REVEAL_COPY.stage1Title);
  });

  it("shows each question's text in payload order", () => {
    const html = render(RECORD);
    for (const question of OPENED.payload.recall_questions) {
      expect(html).toContain(question.text);
    }
    expect(
      html.indexOf(OPENED.payload.recall_questions[0].text),
    ).toBeLessThan(html.indexOf(OPENED.payload.recall_questions[1].text));
  });

  it("shows a number answer exactly as recorded, with the Your answer prefix", () => {
    const html = render(RECORD);
    expect(html).toContain(`${REVEAL_COPY.yourAnswer}: 2.50`);
  });

  it('shows "No answer" for a no-answer entry', () => {
    const html = render(RECORD);
    expect(html).toContain(REVEAL_COPY.noAnswer);
  });

  it("shows the figure's unit for a number question (R8.2)", () => {
    const html = render(RECORD);
    expect(html).toContain(
      REVEAL_COPY.unitLabel.replace("{unit}", "USD per gallon"),
    );
  });

  it('falls back to "No answer" when the record has no entry for a question', () => {
    const html = render({
      version: 1,
      answers: [{ question_id: "q-fuel", kind: "number", value: "2.50" }],
    });
    // q-note has no entry; it still renders as No answer, never blank.
    expect(html).toContain(REVEAL_COPY.noAnswer);
  });

  it("renders no sealed figure value, period, source or comparison (R3.8)", () => {
    const html = render(RECORD);
    const forbidden = [
      "3.412", // the sealed figure value (not the remembered 2.50)
      "2024-10", // the figure's period
      "U.S. EIA", // the figure's source
      "EMM_EPMR_PTE_NUS_DPG", // the series id
      "LETTER_BODY_SECRET", // the letter text
      "https://www.eia.gov/fixture", // the source url
      "%", // a change / comparison
    ];
    for (const needle of forbidden) {
      expect(
        html,
        `stage 1 must not leak "${needle}"`,
      ).not.toContain(needle);
    }
  });
});

/**
 * Stage 1 as the reader actually sees it: the `marks` Stage (design.md
 * "Seal_Break"). It is no longer a plain "Read the letter" / `stage1Next`
 * button — stage 1 now shows the remembered answers as plain text above the
 * unbroken wax seal, the seal instruction line and the "Break the seal" button
 * (`CEREMONY_COPY.sealButton`), all owned by `SealBreak`, plus the
 * "Show everything" control (`REVEAL_COPY.showAll`).
 *
 * `Reveal` is rendered through the real Ceremony providers with
 * `renderToStaticMarkup` in the node env. On the server / first render every
 * provider is at its settled default (full motion, idle hold, default local
 * view), so no effect runs and the markup is the intact seal with its controls
 * — the same static markup the browser hydrates against. Still nothing from
 * inside the letter may appear at stage 1 (R3.8, R9.2, R9.3).
 */
function renderReveal(record: RecallRecordV1, stage: 1 | 2 | 3 = 1): string {
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
              stage,
              onAdvance: () => {},
              onShowAll: () => {},
            }),
          ),
        ),
      ),
    ),
  );
}

describe("Reveal stage 1 is the marks Stage", () => {
  it("keeps the stage 1 heading", () => {
    const html = renderReveal(RECORD);
    expect(html).toContain(REVEAL_COPY.stage1Title);
  });

  it("shows the remembered answers as plain text", () => {
    const html = renderReveal(RECORD);
    // Each question's text and the recorded number answer still render.
    for (const question of OPENED.payload.recall_questions) {
      expect(html).toContain(question.text);
    }
    expect(html).toContain(`${REVEAL_COPY.yourAnswer}: 2.50`);
  });

  it("shows the seal instruction and the 'Break the seal' button, not a 'Read the letter' button", () => {
    const html = renderReveal(RECORD);
    expect(html).toContain(CEREMONY_COPY.sealButton);
    expect(html).toContain(CEREMONY_COPY.sealInstruction);
    // The old stage-1 "Read the letter" / stage1Next control is gone.
    expect(html).not.toContain("Read the letter");
  });

  it("still renders the 'Show everything' control", () => {
    const html = renderReveal(RECORD);
    expect(html).toContain(REVEAL_COPY.showAll);
  });

  it("leaks nothing from inside the letter at stage 1 (R3.8)", () => {
    const html = renderReveal(RECORD);
    const forbidden = [
      "3.412", // the sealed figure value
      "2024-10", // the figure's period
      "U.S. EIA", // the figure's source
      "EMM_EPMR_PTE_NUS_DPG", // the series id
      "LETTER_BODY_SECRET", // the letter text
      "https://www.eia.gov/fixture", // the source url
      "%", // a change / comparison
    ];
    for (const needle of forbidden) {
      expect(
        html,
        `the marks Stage must not leak "${needle}"`,
      ).not.toContain(needle);
    }
  });
});

describe("stage 1 text sits on a paper panel, not the desk (WCAG AA)", () => {
  it("gives the remembered panel a paper background and the ink text colour", () => {
    const css = readFileSync(join(__dirname, "reveal.module.css"), "utf8");
    expect(css).toMatch(/\.remembered\s*\{[^}]*background-color:\s*var\(--paper\)/);
    expect(css).toMatch(/\.remembered\s*\{[^}]*color:\s*var\(--ink\)/);
  });

  it("renders the stage 1 section with the remembered class", () => {
    const html = render(RECORD);
    expect(html).toMatch(/<section class="[^"]*remembered[^"]*">/);
  });
});
