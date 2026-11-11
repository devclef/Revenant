// Feature: 09-P4 (issue #349, task 2): the Seal_Verdict and its fingerprint
// control share one row directly above the paper (P4.3).
//
// Markup and CSS tests, rendered with `renderToStaticMarkup` and `createElement`
// to match the other reveal tests. No DOM library and no JSX.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Reveal, type RevealProps } from "./Reveal";
import { REVEAL_COPY } from "./copy";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import type { Opened } from "./opening-machine";
import type { RecallRecordV2 } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

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
  letterId: "letter-seal-row",
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
    ],
  } satisfies PayloadV1,
};

const RECORD: RecallRecordV2 = {
  version: 2,
  answers: [
    { question_id: "q-first", kind: "text", value: "The first answer." },
  ],
};

const PERSONA_CLOSE = {
  kind: "persona" as const,
  personaKey: "us-maya",
  demo2On: false,
};

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
              close: PERSONA_CLOSE,
              phone: false,
              ...extra,
            }),
          ),
        ),
      ),
    ),
  );
}

/** The markup of the one seal row, from its opening tag to its last closing tag. */
function sealRowHtml(html: string): string {
  const start = html.indexOf('data-seal-row=""');
  if (start < 0) return "";
  // The row ends after the disclosure that holds the fingerprint.
  const end = html.indexOf("</details>", start);
  return end < 0 ? "" : html.slice(start, end + "</details>".length);
}

describe("Reveal: the Seal_Verdict and fingerprint control share one row (P4.3)", () => {
  beforeEach(() => {
    useFiguresSpy.mockClear();
  });

  it("renders one seal row for a persona letter, above the paper", () => {
    const html = renderReveal({ stage: 2 });
    expect(html.match(/data-seal-row=""/g)?.length ?? 0).toBe(1);
    // The row sits before the letter article, so it is above the paper.
    expect(html.indexOf('data-seal-row=""')).toBeLessThan(
      html.indexOf("<article"),
    );
  });

  it("puts both the Seal_Verdict and the fingerprint control inside that row", () => {
    const row = sealRowHtml(renderReveal({ stage: 2 }));
    expect(row).not.toBe("");
    expect(row).toContain(REVEAL_COPY.sealVerdict);
    expect(row).toContain("<summary");
    expect(row).toContain(REVEAL_COPY.fingerprintShow);
  });

  it("lists the verdict before the control, so it reads first on the left", () => {
    const row = sealRowHtml(renderReveal({ stage: 2 }));
    expect(row.indexOf(REVEAL_COPY.sealVerdict)).toBeLessThan(
      row.indexOf(REVEAL_COPY.fingerprintShow),
    );
  });

  it("keeps the persona fingerprint section inside the row", () => {
    const row = sealRowHtml(renderReveal({ stage: 2 }));
    expect(row).toContain('data-fingerprint-persona=""');
  });

  it("does not add the seal row to a live letter", () => {
    const html = renderReveal({
      stage: 2,
      letterKind: "live",
      variant: "live",
      close: { kind: "live", demo2On: true } as unknown as RevealProps["close"],
    });
    expect(html).not.toContain('data-seal-row=""');
  });

  it("lays the row out as a single flex line, with no judgement colour", () => {
    const css = readFileSync(
      join(process.cwd(), "src/components/reveal/reveal.module.css"),
      "utf8",
    );
    const rule = css.match(/\.sealRow\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    const body = rule?.[1] ?? "";
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/flex-wrap:\s*wrap/);
    expect(body).toMatch(/color:\s*var\(--text\)/);
    // The row takes its colour from the desk, never a green or red judgement colour.
    expect(body).not.toMatch(/green|red|#0f0|#f00/i);
  });
});
