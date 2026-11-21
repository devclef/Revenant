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
import type { OpenedPayload } from "@/components/reveal/opened-payload";

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

/** The markup of the one seal line, from its opening tag to the end of its section. */
function sealRowHtml(html: string): string {
  const start = html.indexOf('data-seal-line=""');
  if (start < 0) return "";
  // The seal line is a section; it ends at its closing tag (spec 15 R12.6).
  const end = html.indexOf("</section>", start);
  return end < 0 ? "" : html.slice(start, end + "</section>".length);
}

describe("Reveal: the seal line closes the receipts (spec 15 R12.6)", () => {
  beforeEach(() => {
    useFiguresSpy.mockClear();
  });

  it("renders one seal line for a persona letter, after the letter", () => {
    const html = renderReveal({ stage: 2 });
    expect(html.match(/data-seal-line=""/g)?.length ?? 0).toBe(1);
    expect(html.indexOf('data-seal-line=""')).toBeGreaterThan(
      html.indexOf("data-letter-text"),
    );
  });

  it("puts the intact line and the fingerprint control inside that seal line", () => {
    const row = sealRowHtml(renderReveal({ stage: 2 }));
    expect(row).not.toBe("");
    expect(row).toContain(REVEAL_COPY.sealIntact);
    expect(row).toContain("<summary");
    expect(row).toContain(REVEAL_COPY.fingerprintShow);
  });

  it("lists the intact line before the control, so it reads first on the left", () => {
    const row = sealRowHtml(renderReveal({ stage: 2 }));
    expect(row.indexOf(REVEAL_COPY.sealIntact)).toBeLessThan(
      row.indexOf(REVEAL_COPY.fingerprintShow),
    );
  });

  it("keeps the persona demo label inside the seal line", () => {
    const row = sealRowHtml(renderReveal({ stage: 2 }));
    expect(row).toContain(REVEAL_COPY.fingerprintDemo);
  });

  it("shows the seal line on a live letter too, with no tamper control", () => {
    const html = renderReveal({
      stage: 2,
      letterKind: "live",
      variant: "live",
      close: { kind: "live", demo2On: true } as unknown as RevealProps["close"],
    });
    expect(html.match(/data-seal-line=""/g)?.length ?? 0).toBe(1);
    expect(html).not.toContain("Try to tamper with it");
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

// Change (spec 13, task 2): Reveal passes the Tamper_Control into the Fingerprint
// slot for a persona letter only, from the `tamperSource` prop. Reason: the
// control is for persona letters on the Read step (A1.1, A1.2). The tests below
// check the persona placement and that live and real letters never get it.
describe("Reveal Tamper_Control placement (spec 13 A1.1, A1.2)", () => {
  it("renders the control on a persona letter's Read step, beside the seal verdict", () => {
    const html = renderReveal({
      letterKind: "persona",
      tamperSource: () => null,
    });
    expect(html).toContain("Try to tamper with it");
    expect(html).toContain('data-seal-line=""');
    expect(html.indexOf("Try to tamper with it")).toBeGreaterThan(
      html.indexOf('data-seal-line=""'),
    );
  });

  it("renders no control when no tamperSource is passed", () => {
    const html = renderReveal({ letterKind: "persona" });
    expect(html).not.toContain("Try to tamper with it");
  });

  it("renders no control for a live letter (A1.2)", () => {
    const html = renderReveal({
      letterKind: "live",
      variant: "live",
      tamperSource: () => null,
    });
    expect(html).not.toContain("Try to tamper with it");
  });

  it("renders no control for a real letter (A1.2)", () => {
    const html = renderReveal({
      letterKind: "real",
      variant: "live",
      tamperSource: () => null,
    });
    expect(html).not.toContain("Try to tamper with it");
  });
});
