import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Reveal, type RevealProps } from "./Reveal";
import { REVEAL_COPY } from "./copy";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import type { Opened, TestimonyEntry } from "./opening-machine";
import type { RecallRecordV2 } from "@/lib/recall";
import type { OpenedPayload } from "@/components/reveal/opened-payload";

/**
 * The Remembered_Phrase (spec 16, task 2). The reader's side of the reveal is
 * labelled "You remembered, just now". The spoken prefix "Your answer" lives only
 * in REVEAL_COPY.answerSpokenPrefix, read by the recall scale. It never appears
 * as visible or announced text on the break, the letter or the receipts.
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

const PAYLOAD: OpenedPayload = {
  letter_text: LETTER,
  metrics: [],
  figures: [],
  recall_questions: [
    {
      id: "q-first",
      answer_type: "text",
      text: "What was the first thing on your mind that autumn?",
    },
  ],
} satisfies OpenedPayload;

function openedWith(sealedAt: string): Opened {
  return {
    letterId: "letter-phrase",
    header: {
      sealedAt,
      opensAt: "2024-11-05T00:00:00.000Z",
    },
    openingKey: {} as unknown as CryptoKey,
    envelopeHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    payload: PAYLOAD,
  };
}

const RECORD: RecallRecordV2 = {
  version: 2,
  answers: [{ question_id: "q-first", kind: "text", value: "The first answer." }],
};

const PERSONA_CLOSE = { kind: "persona" as const, personaKey: "us-maya", demo2On: false };
const LIVE_CLOSE = { kind: "live" as const, demo2On: false };

const PRIYA_TESTIMONY: readonly TestimonyEntry[] = [
  {
    question: "What was the first thing on your mind that autumn?",
    answer: "The commute, mostly.",
  },
];

function renderReveal(extra: Partial<RevealProps>): string {
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
              opened: openedWith("2024-10-01T00:00:00.000Z"),
              record: RECORD,
              personaName: "Maya",
              stage: 1,
              onAdvance: () => {},
              onShowAll: () => {},
              close: PERSONA_CLOSE,
              phone: false,
              ...extra,
            } as RevealProps),
          ),
        ),
      ),
    ),
  );
}

/** Every string value in a copy object, nested objects and arrays included. */
function stringsOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(stringsOf);
  }
  return [];
}

describe("the Remembered_Phrase copy (spec 16, task 2)", () => {
  it("names the spoken prefix for a recall answer, separate from the visible label", () => {
    expect(REVEAL_COPY.answerSpokenPrefix).toBe("Your answer");
    expect(REVEAL_COPY.yourAnswer).toBe("You remembered, just now");
    expect(REVEAL_COPY.stage1Title).toBe("You remembered, just now");
    expect(REVEAL_COPY.marksSummary).toBe("You remembered, just now");
    expect(REVEAL_COPY.saidJustNow).toBe("You remembered, just now");
    expect(CEREMONY_COPY.markAnswer).toBe("You remembered, just now: {value} {unit}");
    expect(CEREMONY_COPY.lineAnswer).toBe("You remembered, just now");
    expect(CEREMONY_COPY.numberLineAlt).toContain("You remembered {answer} {unit}.");
  });

  it("uses 'Your answer' in no shown copy string except the spoken prefix", () => {
    const shown = [
      ...stringsOf(REVEAL_COPY),
      ...stringsOf(CEREMONY_COPY),
    ].filter((text) => /\bYour answer\b/.test(text));
    // Only the recall scale's spoken prefix uses the words. Any other string here
    // would reach a screen on the break, the letter or the receipts.
    expect(shown).toEqual([REVEAL_COPY.answerSpokenPrefix]);
  });
});

describe("the reader's side on the reveal stages (spec 16, task 2)", () => {
  it("shows the Remembered_Phrase and no 'Your answer' on a live letter at every stage", () => {
    useFiguresSpy.mockClear();
    for (const stage of [1, 2, 3] as const) {
      const html = renderReveal({ stage, close: LIVE_CLOSE, personaName: undefined });
      expect(html, `stage ${stage}`).not.toContain(REVEAL_COPY.answerSpokenPrefix);
      expect(html, `stage ${stage}`).not.toContain("Your answer");
    }
    const stage1 = renderReveal({ stage: 1, close: LIVE_CLOSE, personaName: undefined });
    expect(stage1).toContain(REVEAL_COPY.stage1Title);
  });

  it("shows no 'Your answer' on a persona letter at every stage", () => {
    for (const stage of [1, 2, 3] as const) {
      const html = renderReveal({ stage });
      expect(html, `stage ${stage}`).not.toContain("Your answer");
    }
  });

  it("gives Priya 'She remembered · fictional' and no Remembered_Phrase at every stage", () => {
    const priya = { testimony: PRIYA_TESTIMONY, personaName: "Priya" };
    let receiptsSeen = false;
    for (const stage of [1, 2, 3] as const) {
      const html = renderReveal({ ...priya, stage });
      expect(html, `stage ${stage}`).not.toContain(REVEAL_COPY.yourAnswer);
      expect(html, `stage ${stage}`).not.toContain(REVEAL_COPY.stage1Title);
      expect(html, `stage ${stage}`).not.toContain("Your answer");
      if (html.includes(REVEAL_COPY.receiptsRememberedPersona)) receiptsSeen = true;
    }
    expect(receiptsSeen).toBe(true);
  });
});
