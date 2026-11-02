import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SealedLetter } from "./SealedLetter";
import { LIVE_COPY, REVEAL_COPY } from "./copy";
import { formatLocalDateTime } from "@/components/live/format";
import type { Opened } from "./opening-machine";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * Live mode of stage 2 (spec 06, R18.2). A live letter shows one seal line
 * from LIVE_COPY and the letter text, and none of the demo wording.
 */

const LETTER_TEXT = "A live letter, written by its reader.\nSecond line.";

const PAYLOAD = {
  format_version: 1,
  letter_text: LETTER_TEXT,
  metrics: [],
  figures: [],
  recall_questions: [],
} as unknown as PayloadV1;

const OPENED: Opened = {
  letterId: "letter-live-1",
  header: {
    sealedAt: "2026-10-01T09:30:00.000Z",
    opensAt: "2026-11-05T00:00:00.000Z",
  },
  payload: PAYLOAD,
  openingKey: {} as unknown as CryptoKey,
};

function render(variant?: "persona" | "live"): string {
  return renderToStaticMarkup(
    createElement(SealedLetter, { opened: OPENED, personaName: "Maya", variant }),
  );
}

describe("SealedLetter, live variant (R18.2)", () => {
  it("shows the local seal line from LIVE_COPY.sealedOn", () => {
    const html = render("live");
    const expected = LIVE_COPY.sealedOn.replace(
      "{sealedAt}",
      formatLocalDateTime(OPENED.header.sealedAt),
    );
    expect(html).toContain(expected);
  });

  it("keeps the letter text in the plain-text element", () => {
    const html = render("live");
    expect(html).toContain("data-ink-text");
    expect(html).toContain("A live letter, written by its reader.");
    expect(html).toContain("Second line.");
  });

  it("carries none of the demo wording", () => {
    const html = render("live");
    expect(html).not.toContain("Written as of");
    expect(html).not.toContain("Prepared later as a demo");
    expect(html).not.toContain(REVEAL_COPY.sealedForDemoOn.split("{")[0]);
    expect(html).not.toContain("A demo letter.");
  });

  it("the default persona variant is unchanged and has no live line", () => {
    const html = render();
    expect(html).toContain(REVEAL_COPY.demoLetterLabel.split("{")[0]);
    expect(html).not.toContain(LIVE_COPY.sealedOn.split("{")[0]);
  });
});
