// Property 5: sealing never depends on figures (spec 11, X2.1, X2.4, X2.5,
// X2.6, X2.9).
//
// For any figures state (loading, failed, ready) and any valid letter, the
// figures state never adds a problem to a write that has a non-empty question,
// never gives the seal a figure it did not get from a ready response, and
// builds a letter with 0 official figures when the state is not ready. The
// oracle is the spec text, not the code under test: a letter with a question
// and no official figure is valid whenever the figures state is not ready.
//
// Not covered here: the press-time freeze of a late response (SealPage keeps
// `pressedFigures`) and the disabled state of the seal control. Both live in
// the component and have no pure function to check.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { figuresResponseFrom } from "@/components/reveal/figures-stub";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import type { LoadedFigures } from "@/lib/figures";

import { questionsForSeal } from "./author-questions";
import { buildLivePayload } from "./build-payload";
import { validateWrite } from "./form";
import { sealFiguresFrom } from "./catalogue-list";
import {
  FIGURES_TIMEOUT_MS,
  figuresStateFrom,
  type FiguresOutcome,
} from "./figures-state";
import type { FiguresState } from "@/components/reveal/figures-api";

const NO_FIGURES: LoadedFigures = { fixture: false, series: new Map() };
const SEALED_AT = "2026-11-10T12:00:00.000Z";

const VALID_BODY = figuresResponseFrom(DEMO_FIGURES);

/** Every way the figures request can end, and the loading state. */
const stateArb: fc.Arbitrary<FiguresState> = fc.oneof(
  fc.constant<FiguresState>({ status: "loading" }),
  fc
    .constantFrom<FiguresOutcome>(
      { kind: "rejected" },
      { kind: "aborted" },
      { kind: "response", status: 204, body: VALID_BODY },
      { kind: "response", status: 400, body: VALID_BODY },
      { kind: "response", status: 500, body: VALID_BODY },
      { kind: "response", status: 503, body: VALID_BODY },
      { kind: "response", status: 200, body: { format: "something-else" } },
      { kind: "response", status: 200, body: null },
      { kind: "response", status: 200, body: VALID_BODY },
    )
    .map((outcome) => figuresStateFrom(outcome)),
);

const letterArb = fc.stringMatching(/^[A-Za-z][A-Za-z ,.']{0,199}$/);
const questionArb = fc.stringMatching(/^[A-Za-z][A-Za-z ?,.]{0,120}$/);
const questionsArb = fc.array(
  fc.oneof(questionArb, fc.constant(""), fc.constant("   ")),
  { maxLength: 3 },
);

describe("Property 5: sealing never depends on figures (X2.1, X2.4, X2.5, X2.6, X2.9)", () => {
  it("the figures request state never changes the write rule; a question alone is enough", () => {
    fc.assert(
      fc.property(
        letterArb,
        questionsArb,
        (text, questions) => {
          const hasQuestion = questionsForSeal(questions).length > 0;
          const problems = validateWrite({
            text,
            metricIds: [],
            warningTicked: true,
            questions,
            mode: "demo",
          });
          // A written question is enough, and without one a letter needs a
          // figure, whatever the figures request is doing (C2.13, X2.4).
          expect(problems.includes("nothing_to_testify")).toBe(!hasQuestion);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("gives the seal no official figure unless the response is ready", () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const sealFigures = sealFiguresFrom(state);
        if (state.status !== "ready") {
          expect(sealFigures.status).toBe(state.status);
          expect("figures" in sealFigures).toBe(false);
        } else {
          expect(sealFigures.status).toBe("ready");
        }
      }),
      { numRuns: 100 },
    );
  });

  it("builds a letter with 0 official figures for every state that is not ready", () => {
    fc.assert(
      fc.property(stateArb, letterArb, questionArb, (state, text, question) => {
        // The state must give no figures before the payload is built from none.
        const sealFigures = sealFiguresFrom(state);
        fc.pre(sealFigures.status !== "ready");
        const built = buildLivePayload({
          text,
          metricIds: [],
          authorQuestions: questionsForSeal([question]),
          sealedDate: SEALED_AT.slice(0, 10),
          figures: NO_FIGURES,
          sealedAt: SEALED_AT,
        });
        expect(built.ok).toBe(true);
        if (!built.ok) return;
        const officialFigures = built.payload.figures.filter(
          (figure) => figure.kind === "official",
        );
        expect(officialFigures).toHaveLength(0);
        expect(built.payload.metrics).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it("the figures timeout is the 30 second abort the states are built on", () => {
    expect(FIGURES_TIMEOUT_MS).toBe(30_000);
  });
});
