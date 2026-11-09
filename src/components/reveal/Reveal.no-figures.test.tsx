import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Reveal, type RevealProps } from "./Reveal";
import { REVEAL_COPY } from "./copy";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import type { Opened } from "./opening-machine";
import type { RecallRecordV2 } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * A letter with no sealed figures and two Author_Questions (spec 10 C8.6). The
 * reveal must not request the Figures_API, must show the Author_Testimony
 * above the letter, and must reach the Close at stage 2 and at stage 3.
 */

const { useFiguresSpy } = vi.hoisted(() => ({ useFiguresSpy: vi.fn() }));

vi.mock("./figures-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./figures-api")>();
  return {
    ...actual,
    useFigures: () => {
      useFiguresSpy();
      return { status: "loading" as const };
    },
  };
});

const LETTER = "A short letter with no figures in it.";

const OPENED: Opened = {
  letterId: "letter-no-figures",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: {
    format_version: 1,
    letter_text: LETTER,
    metrics: [],
    figures: [],
    recall_questions: [
      {
        id: "q-first",
        answer_type: "text",
        text: "What was the first thing on your mind that autumn?",
      },
      {
        id: "q-second",
        answer_type: "text",
        text: "Who did you talk to most that month?",
      },
    ],
  } satisfies PayloadV1,
};

const RECORD: RecallRecordV2 = {
  version: 2,
  answers: [
    { question_id: "q-first", kind: "text", value: "The first answer." },
    { question_id: "q-second", kind: "no_answer" },
  ],
};

const CLOSE = { kind: "persona" as const, personaKey: "us-maya", demo2On: false };

function renderReveal(extra: Partial<RevealProps> = {}): string {
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
              record: RECORD,
              personaName: "Maya",
              stage: 2,
              onAdvance: () => {},
              onShowAll: () => {},
              close: CLOSE,
              phone: false,
              ...extra,
            }),
          ),
        ),
      ),
    ),
  );
}

describe("Reveal with no sealed figures (spec 10 C8.6)", () => {
  beforeEach(() => {
    useFiguresSpy.mockClear();
  });

  it("makes no figures request", () => {
    renderReveal({ stage: 2 });
    renderReveal({ stage: 3 });
    expect(useFiguresSpy).not.toHaveBeenCalled();
  });

  it("shows the Author_Testimony above the letter, with each answer as recorded", () => {
    const html = renderReveal({ stage: 2 });
    const testimony = html.indexOf('data-author-testimony=""');
    const letter = html.indexOf("<article");
    expect(testimony).toBeGreaterThanOrEqual(0);
    expect(letter).toBeGreaterThan(testimony);
    expect(html).toContain(REVEAL_COPY.authorTestimonyTitle);
    expect(html).toContain("The first answer.");
    expect(html).toContain(REVEAL_COPY.noAnswer);
  });

  it("keeps the letter text as one unchanged paragraph", () => {
    const html = renderReveal({ stage: 2 });
    expect(html.match(/<p[^>]*>A short letter with no figures in it\.<\/p>/g) ?? []).toHaveLength(1);
  });

  it("shows no figures stage, no See the receipts and no Show everything at stage 2", () => {
    const html = renderReveal({ stage: 2 });
    expect(html).not.toContain(REVEAL_COPY.stage2Next);
    expect(html).not.toContain(REVEAL_COPY.showAll);
    expect(html).not.toContain("data-figures-panel");
    expect(html).not.toContain(REVEAL_COPY.stage3Title);
  });

  it("reaches the Close at stage 2", () => {
    const html = renderReveal({ stage: 2 });
    expect(html).toContain(CEREMONY_COPY.closeLine);
    expect(html).toContain("data-close-line");
  });

  it("reaches the Close at stage 3 too, with no figures panel", () => {
    const html = renderReveal({ stage: 3 });
    expect(html).toContain(CEREMONY_COPY.closeLine);
    expect(html).not.toContain("data-figures-panel");
  });
});
