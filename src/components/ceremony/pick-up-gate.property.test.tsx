// Feature: 07-judge-journey, Property 1: The Pick_Up_Button is never rendered before `verified` (fast-check)
// Feature: 07-judge-journey, R9.8 to R9.12

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { REVEAL_COPY } from "@/components/reveal/copy";
import type { FlowState } from "@/components/reveal/opening-machine";
import { EnvelopeView, type EnvelopeViewVariant } from "./envelope/EnvelopeView";
import { LocalViewProvider } from "./local-view";
import { showPickUp, type LocalView } from "./stages";

const TAGS: FlowState["tag"][] = [
  "loading",
  "sealed",
  "openable",
  "awaiting_key",
  "unlocking",
  "verifying",
  "verified",
  "not_placed",
  "unreachable",
  "verification_failed",
  "open_failed",
];

// The envelope variant each tag routes to. Only `verified` routes to the
// variant that holds the Pick_Up_Button. Error tags have no envelope scene.
const VARIANT_FOR: Partial<Record<FlowState["tag"], EnvelopeViewVariant>> = {
  loading: "loading",
  openable: "openable",
  verifying: "verifying",
  sealed: "sealed",
  awaiting_key: "unlock",
  unlocking: "unlock",
  verified: "verified",
};

const tag = fc.constantFrom(...TAGS);
const local = fc.record({
  emergence: fc.constantFrom<LocalView["emergence"]>("running", "done"),
  sealing: fc.boolean(),
  step: fc.constantFrom<LocalView["step"]>("then", "passage", "now", "done"),
});

describe("Property 1: the Pick_Up_Button is never rendered before verified", () => {
  it("shows the gate only for verified with the Emergence done", () => {
    fc.assert(
      fc.property(tag, local, (t, view) => {
        expect(showPickUp(t, view)).toBe(t === "verified" && view.emergence === "done");
      }),
      { numRuns: 100 },
    );
  });

  it("renders the begin control only for the verified variant, and only once settled", () => {
    fc.assert(
      fc.property(tag, (t) => {
        const variant = VARIANT_FOR[t];
        if (variant === undefined) return;
        // The Ceremony's default local view is `done`, so the rendered
        // verified variant shows the control and every other variant does not.
        const html = renderToStaticMarkup(
          createElement(
            LocalViewProvider,
            null,
            createElement(EnvelopeView, { variant }),
          ),
        );
        const hasButton = html.includes(REVEAL_COPY.begin);
        expect(hasButton).toBe(t === "verified");
      }),
      { numRuns: 100 },
    );
  });
});
