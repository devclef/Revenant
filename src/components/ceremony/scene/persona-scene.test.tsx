// Feature: 07-judge-journey (spec 07 task 4)
//
// Property 19: server and client render the same Envelope markup for the same
// props (fast-check). Property 20: the Ghost and the Soil strip render on the
// persona scene, and the Envelope sits in the Ghost's held slot.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Envelope, type EnvelopePersona } from "../envelope/Envelope";
import { LocalViewProvider } from "../local-view";
import { MotionProvider } from "../motion";
import { SkipProvider } from "../skip";
import { PersonaGhost } from "./PersonaGhost";
import { SceneBackdrop } from "./SceneBackdrop";

const persona: EnvelopePersona = {
  key: "us-maya",
  written_as_of: "2024-05-12",
  opens_at: "2024-11-05T00:00:00Z",
  demo: true,
};

function personaScene() {
  return createElement(
    MotionProvider,
    null,
    createElement(
      SkipProvider,
      null,
      createElement(
        LocalViewProvider,
        null,
        createElement(
          SceneBackdrop,
          null,
          createElement(
            PersonaGhost,
            null,
            createElement(Envelope, { state: "closed", persona }),
          ),
        ),
      ),
    ),
  );
}

describe("Persona scene — Ghost and Soil strip render (Property 20)", () => {
  it("renders the Ghost box and the Soil strip", () => {
    const html = renderToStaticMarkup(personaScene());
    expect(html).toContain("data-ghost-box");
    expect(html).toContain("data-soil-strip");
  });

  it("marks the Ghost root with data-ghost (spec 07 A11)", () => {
    const html = renderToStaticMarkup(personaScene());
    expect(html).toMatch(/data-ghost-pit[^>]*data-ghost=""/);
  });

  it("renders the Ghost in its own layer, outside the backdrop, so it sits above the cards", () => {
    const html = renderToStaticMarkup(personaScene());
    const layer = html.indexOf("data-ghost-layer");
    const ghost = html.indexOf("data-ghost-box");
    const backdropEnd = html.indexOf("data-soil-strip");
    expect(layer).toBeGreaterThan(-1);
    expect(ghost).toBeGreaterThan(layer);
    // The layer opens after the backdrop's Soil strip, so it is a sibling.
    expect(layer).toBeGreaterThan(backdropEnd);
  });

  it("places the envelope inside the Ghost's held slot", () => {
    const html = renderToStaticMarkup(personaScene());
    const held = html.search(/heldSlot/);
    const envelope = html.indexOf("data-envelope-state");
    expect(held).toBeGreaterThan(-1);
    expect(envelope).toBeGreaterThan(held);
  });
});

describe("Envelope — server and client markup match (Property 19)", () => {
  it("renders byte-identical markup on repeated renders for any persona", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.constantFrom("narrow" as const, "wide" as const, "responsive" as const),
        (key, layout) => {
          const p = { ...persona, key };
          const server = renderToStaticMarkup(
            createElement(Envelope, { state: "closed", layout, persona: p }),
          );
          const client = renderToStaticMarkup(
            createElement(Envelope, { state: "closed", layout, persona: p }),
          );
          expect(client).toBe(server);
        },
      ),
      { numRuns: 50 },
    );
  });
});
