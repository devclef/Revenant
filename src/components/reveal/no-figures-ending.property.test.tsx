// Feature: 11-any-letter, Property 11: A reveal with no figures ends on the letter
//
// For any letter kind (persona text-only, Live_Letter, Real_Letter) with no
// official figure, and any local view: stageFor returns `close` at stages 2 and 3,
// and the stage list has no `figures` Stage, so the letter comes before the close.
// The rendered Reveal holds no "then and now" heading, no Receipt_Card, no
// Number_Line, no figures heading and no "See the receipts" or "See the numbers"
// control, and it makes no figures request.
//
// Validates spec 11 L5.1, L5.3, L5.4 and L5.5.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import {
  DEFAULT_LOCAL_VIEW,
  stageFor,
  stageListFor,
  type LocalView,
} from "@/components/ceremony/stages";
import type { FlowState, Opened } from "./opening-machine";
import type { RecallRecordV2 } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

import { Reveal, type RevealProps } from "./Reveal";
import { REVEAL_COPY } from "./copy";

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

type Kind = "persona" | "live" | "real";

const KINDS: readonly Kind[] = ["persona", "live", "real"];

const OPENED: Opened = {
  letterId: "letter-no-figures-property",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: {
    format_version: 1,
    letter_text: "A short letter with no figures in it.",
    metrics: [],
    figures: [],
    recall_questions: [
      {
        id: "q-a",
        answer_type: "text",
        text: "What was on your mind that week?",
      },
    ],
  } satisfies PayloadV1,
};

const RECORD: RecallRecordV2 = {
  version: 2,
  answers: [{ question_id: "q-a", kind: "no_answer" }],
};

function revealState(stage: 2 | 3): Extract<FlowState, { tag: "reveal" }> {
  return { tag: "reveal", opened: OPENED, record: RECORD, stage };
}

const localViewArb: fc.Arbitrary<LocalView> = fc.record({
  emergence: fc.constantFrom<LocalView["emergence"]>("running", "done"),
  sealing: fc.boolean(),
  figures: fc.constantFrom<LocalView["figures"]>("running", "settled"),
});

const kindArb = fc.constantFrom<Kind>(...KINDS);
const stageArb = fc.constantFrom<2 | 3>(2, 3);

function kindProps(kind: Kind): Partial<RevealProps> {
  if (kind === "live") {
    return { variant: "live", letterKind: "live", close: { kind: "live" } };
  }
  if (kind === "real") {
    return { letterKind: "real", close: { kind: "real" } };
  }
  return {
    letterKind: "persona",
    close: { kind: "persona", personaKey: "us-maya", demo2On: false },
  };
}

function renderReveal(kind: Kind, stage: 2 | 3): string {
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
              stage,
              onAdvance: () => {},
              onShowAll: () => {},
              phone: false,
              ...kindProps(kind),
            }),
          ),
        ),
      ),
    ),
  );
}

const FIGURES_MARKERS = [
  REVEAL_COPY.stage3Title,
  "data-receipt-card",
  "data-line-axis",
  "data-line-tick",
  "data-figures-heading",
  "data-figures-panel",
  REVEAL_COPY.stage2Next,
  "See the numbers",
];

const FIGURES_HEADING =
  /<h[1-6][^>]*>[^<]*(then and now|figures)[^<]*<\/h[1-6]>/i;

describe("Property 11: a reveal with no figures ends on the letter (spec 11 L5)", () => {
  it("stageFor is close at stages 2 and 3 for any local view, and the list ends on the letter", () => {
    fc.assert(
      fc.property(stageArb, localViewArb, (stage, local) => {
        expect(stageFor(revealState(stage), local)).toBe("close");
        const stages = stageListFor(false);
        expect(stages).not.toContain("figures");
        expect(stages.indexOf("letter")).toBeLessThan(stages.indexOf("close"));
      }),
      { numRuns: 100 },
    );
  });

  it("keeps the default local view on close as well", () => {
    fc.assert(
      fc.property(stageArb, (stage) => {
        expect(stageFor(revealState(stage), DEFAULT_LOCAL_VIEW)).toBe("close");
      }),
      { numRuns: 20 },
    );
  });

  it("renders no figures markup and makes no figures request for every kind and stage", () => {
    useFiguresSpy.mockClear();
    fc.assert(
      fc.property(kindArb, stageArb, (kind, stage) => {
        const html = renderReveal(kind, stage);
        for (const marker of FIGURES_MARKERS) {
          expect(html, `${kind} stage ${stage}: ${marker}`).not.toContain(
            marker,
          );
        }
        expect(html).not.toMatch(FIGURES_HEADING);
        expect(html).not.toContain(CEREMONY_COPY.skipToReceipts);
      }),
      { numRuns: 30 },
    );
    expect(useFiguresSpy).not.toHaveBeenCalled();
  });
});
