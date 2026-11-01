// Feature: 05-reveal-ceremony
//
// Markup tests for the ink letter (R7.2, Property 14's ink clause). Rendered with
// `renderToStaticMarkup`, the server and first client render. Layout effects do
// not run in this node environment, so these tests check the first render:
//
//   - the full letter text is in the markup from the first render;
//   - the letter paragraph is the one marked `data-ink-text`;
//   - no mask style is present before the effect runs.
//
// The mask behaviour itself (only mask-* touched, keyframes, cancel) is tested
// against the helpers in inkMask.test.ts.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MotionProvider } from "../motion";
import { REVEAL_COPY } from "@/components/reveal/copy";
import type { Opened } from "@/components/reveal/opening-machine";
import type { PayloadV1 } from "@/lib/seal-format";
import { InkLetter } from "./InkLetter";

const PERSONA_NAME = "Maya";

const LETTER_TEXT =
  "INK_LETTER_TEXT first line.\nSecond line, after a break.\n\nA  double  space and a blank line above.";

const PAYLOAD = {
  format_version: 1,
  letter_text: LETTER_TEXT,
  written_as_of: "2024-10-15",
  metrics: [],
  figures: [],
  recall_questions: [],
} as unknown as PayloadV1;

const OPENED: Opened = {
  letterId: "letter-ink",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  payload: PAYLOAD,
};

function render(): string {
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(InkLetter, { opened: OPENED, personaName: PERSONA_NAME }),
    ),
  );
}

describe("InkLetter first render", () => {
  it("has the full letter text in the markup from the first render", () => {
    const html = render();
    const encoded = renderToStaticMarkup(createElement("p", null, LETTER_TEXT));
    const inner = encoded.slice("<p>".length, -"</p>".length);
    expect(html).toContain(inner);
  });

  it("marks the letter paragraph with data-ink-text", () => {
    const html = render();
    expect(html).toMatch(/<p[^>]*data-ink-text[^>]*>/);
  });

  it("keeps the labels in the markup, unmasked", () => {
    const html = render();
    expect(html).toContain(REVEAL_COPY.stage2Title);
    expect(html).toContain(REVEAL_COPY.demoLetterLabel.replace("{name}", PERSONA_NAME));
  });

  it("has no mask style before the layout effect runs", () => {
    const html = render();
    expect(html).not.toMatch(/mask/i);
  });
});
