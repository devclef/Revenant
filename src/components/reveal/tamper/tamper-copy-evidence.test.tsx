// Feature: 13-the-seal, copy evidence (spec 13, A4.1, A4.2, G2.7).
//
// The tamper copy and the rendered persona Read step must pass the tone rules
// in tools/hooks/tone-check.mjs and must not contain the words A4.2 forbids.
// The pressed result is built from `tamperResultCopy`, so both result branches
// are checked as strings here, not only the closed control.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Reveal, type RevealProps } from "@/components/reveal/Reveal";
import type { Opened } from "@/components/reveal/opening-machine";
import type { RecallRecordV2 } from "@/lib/recall";
import type { OpenedPayload } from "@/components/reveal/opened-payload";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import { TAMPER_COPY, tamperResultCopy } from "./tamper-copy";
import type { TamperRun } from "./tamper-run";

vi.mock("@/components/reveal/figures-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/reveal/figures-api")>();
  return {
    ...actual,
    useFigures: () => ({ status: "loading" as const }),
  };
});

/** Words A4.2 forbids. They must not appear in the tamper copy or the Read step. */
const A42_FORBIDDEN: readonly RegExp[] = [
  /\bcaught\b/i,
  /\bwrong\b/i,
  /\bhacked\b/i,
  /\battack\b/i,
  /failed to break/i,
  /congratulat/i,
  /\bscore\b/i,
];

/** The judgement and scoring words of tools/hooks/tone-check.mjs. */
const TONE_JUDGEMENT: readonly RegExp[] = [
  /\b(soared|plunged|skyrocketed|finally|cheaper|dearer|better|worse)\b/i,
  /\b(accuracy|accurate|score|off by)\b/i,
];

/** Strings a judge can read in the tamper control and its result. */
function tamperCopyStrings(): string[] {
  const out: string[] = Object.values(TAMPER_COPY);
  // Both result branches, built from fixed runs. The cracked run needs the
  // refusal the real check gives; the other gets the plain message.
  const cracked = tamperResultCopy({
    untampered: { ok: true } as TamperRun["untampered"],
    result: {
      ok: false,
      error: { kind: "verification_failed" },
    } as TamperRun["result"],
    change: { byteIndex: 32, total: 64, before: 0x3a, after: 0x3b },
    copyHash: "0".repeat(64),
  });
  if (cracked.kind === "cracked") {
    out.push(cracked.heading, cracked.change, cracked.reliefNotProof);
  }
  const plain = tamperResultCopy({
    untampered: { ok: false } as TamperRun["untampered"],
    result: { ok: true } as TamperRun["result"],
    change: { byteIndex: 0, total: 64, before: 0, after: 1 },
    copyHash: "0".repeat(64),
  });
  if (plain.kind === "not_as_expected") out.push(plain.message);
  return out;
}

describe("tamper copy follows the tone rules (A4.1, A4.2)", () => {
  const strings = tamperCopyStrings();

  it("has copy to check, not an empty set", () => {
    expect(strings.length).toBeGreaterThan(5);
  });

  it("has no exclamation mark", () => {
    for (const value of strings) expect(value).not.toContain("!");
  });

  it("has no judgement or scoring word", () => {
    for (const value of strings) {
      for (const pattern of TONE_JUDGEMENT) {
        expect(value, `"${value}" must not match ${pattern}`).not.toMatch(
          pattern,
        );
      }
    }
  });

  it("has none of the words A4.2 forbids", () => {
    for (const value of strings) {
      for (const pattern of A42_FORBIDDEN) {
        expect(value, `"${value}" must not match ${pattern}`).not.toMatch(
          pattern,
        );
      }
    }
  });
});

// The persona Read step, rendered the way Reveal.test.tsx renders it.
const LETTER = "A short letter with no figures in it.";

const OPENED: Opened = {
  letterId: "letter-tamper-copy",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: {
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
  } satisfies OpenedPayload,
};

const RECORD: RecallRecordV2 = {
  version: 2,
  answers: [
    { question_id: "q-first", kind: "text", value: "The first answer." },
  ],
};

function renderPersonaReadStep(): string {
  const props: Partial<RevealProps> = {
    letterKind: "persona",
    tamperSource: () => null,
  };
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
              close: { kind: "persona", personaKey: "us-maya", demo2On: false },
              phone: false,
              ...props,
            }),
          ),
        ),
      ),
    ),
  );
}

describe("the rendered persona Read step carries none of the A4.2 words (A4.2)", () => {
  const html = renderPersonaReadStep();

  it("renders the Tamper_Control on the Read step, so the scan covers it", () => {
    expect(html).toContain(TAMPER_COPY.button);
    expect(html).toContain(TAMPER_COPY.note);
  });

  it("has none of the words A4.2 forbids in its visible text", () => {
    // Only visible text is checked: tags and attribute values are stripped.
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    for (const pattern of A42_FORBIDDEN) {
      expect(visible, `the Read step must not match ${pattern}`).not.toMatch(
        pattern,
      );
    }
  });
});
