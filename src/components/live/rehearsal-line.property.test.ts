// Property 19: the Rehearsal_Line appears only on the live demo (spec 11, L4.1,
// L4.3, L4.4, L4.5).
//
// The line shows under the /demo/live Write heading (SealPage, covered by the
// example tests in SealPage.test.tsx) and next to the Wait countdown (checked
// here over every step, every prop value and clocks on both sides of the
// opening time). A source scan then checks that no other page or component
// can show it: /seal, a Real_Letter at /l/[id] and the persona pages.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { readSourceFiles } from "../../test/source-scan";

import { LIVE_COPY } from "./copy";
import type { SealedState } from "./SealedView";
import { LiveWaitStep } from "./stepper/LiveWaitStep";

const OPENS_AT = "2026-11-08T00:00:00.000Z";
const OPENS_MS = Date.parse(OPENS_AT);

const sealed: SealedState = {
  tag: "sealed",
  letterId: "AAAAAAAAAAAAAAAAAAAAAA",
  sealedAt: "2026-11-07T12:00:00.000Z",
  opensAt: OPENS_AT,
  offsetMs: 0,
  factors: "passkey",
  envelopeHash: "a".repeat(64),
};

type WaitStep = "wait" | "testify" | "receipts";

describe("Property 19: the Rehearsal_Line appears only on the live demo", () => {
  it("shows on the Wait step, and only when the rehearsal prop is true", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<WaitStep>("wait", "testify", "receipts"),
        fc.constantFrom<boolean | undefined>(undefined, true, false),
        fc.integer({ min: -120_000, max: 120_000 }),
        (step, rehearsal, offsetMs) => {
          const html = renderToStaticMarkup(
            createElement(LiveWaitStep, {
              state: sealed,
              appOrigin: "https://revenant.example",
              step,
              advanceTo: () => undefined,
              nowMs: () => OPENS_MS + offsetMs,
              rehearsal,
            }),
          );
          const shows = step === "wait" && rehearsal === true;
          expect(html.includes(LIVE_COPY.rehearsalLine)).toBe(shows);
          expect(html.includes("data-live-rehearsal")).toBe(shows);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property 19: no other page or component can show the line", () => {
  const files = readSourceFiles(["src"], [".ts", ".tsx"]);

  it("only the copy module and the two live components name rehearsalLine", () => {
    const users = files
      .filter((file) => file.text.includes("rehearsalLine"))
      .map((file) => file.path)
      .sort();
    expect(users).toEqual([
      "src/components/live/SealPage.tsx",
      "src/components/live/copy.ts",
      "src/components/live/stepper/LiveWaitStep.tsx",
    ]);
  });

  it("only the Write step (SealPage) and the Wait step (LiveWaitStep) render the line", () => {
    const rendering = files
      .filter((file) => file.text.includes("LIVE_COPY.rehearsalLine"))
      .map((file) => file.path)
      .sort();
    expect(rendering).toEqual([
      "src/components/live/SealPage.tsx",
      "src/components/live/stepper/LiveWaitStep.tsx",
    ]);
  });

  it("only /demo/live passes the rehearsal prop, so /seal, /l/[id] and persona pages never get it", () => {
    const routeFiles = files
      .filter((file) => file.path.startsWith("src/app/"))
      .filter((file) => /\brehearsal\b/.test(file.text))
      .map((file) => file.path);
    expect(routeFiles).toEqual(["src/app/demo/live/page.tsx"]);
  });
});
