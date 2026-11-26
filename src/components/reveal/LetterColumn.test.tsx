import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/ceremony/motion";
import type { Opened } from "./opening-machine";
import type { PayloadV1 } from "@/lib/seal-format";
import { REVEAL_COPY } from "./copy";

const scroll = vi.hoisted(() => ({ overflowing: false }));

vi.mock("./own-scroll", () => ({
  useOwnScroll: () => scroll.overflowing,
}));

import { LetterColumn } from "./LetterColumn";

const PERSONA_NAME = "Maya";

function openedWith(letterText: string): Opened {
  const payload: PayloadV1 = {
    format_version: 1,
    letter_text: letterText,
    written_as_of: "2024-10-15",
    metrics: [],
    figures: [],
    recall_questions: [],
  };
  return {
    letterId: "letter-1",
    header: {
      sealedAt: "2024-10-01T00:00:00.000Z",
      opensAt: "2024-11-05T00:00:00.000Z",
    },
    openingKey: {} as unknown as CryptoKey,
    envelopeHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    payload,
  };
}

function render(split: boolean, still: boolean): string {
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(LetterColumn, {
        split,
        still,
        paper: {
          opened: openedWith("Body."),
          personaName: PERSONA_NAME,
        },
      }),
    ),
  );
}

/** The opening tag of the wrapper, so attributes on the paper are not counted. */
function wrapperTag(html: string): string {
  const match = html.match(/<div[^>]*data-letter-stage=""[^>]*>/);
  return match?.[0] ?? "";
}

beforeEach(() => {
  scroll.overflowing = false;
});

describe("LetterColumn", () => {
  it("renders the data-letter-stage wrapper with the stage classes and the column class", () => {
    const tag = wrapperTag(render(false, false));
    // CSS module class names are hashed in tests (for example `_stage_b86264`).
    expect(tag).toMatch(/class="[^"]*_stage_/);
    expect(tag).toMatch(/class="[^"]*_fade_/);
    expect(tag).toMatch(/class="[^"]*_letterCol_/);
    expect(tag).toMatch(/class="[^"]*_letterColumn_/);
  });

  it("holds the letter paper inside the wrapper", () => {
    const html = render(false, false);
    expect(html).toContain("Body.");
    expect(html.indexOf("data-letter-stage")).toBeLessThan(html.indexOf("Body."));
  });

  it("marks the split only when split is true", () => {
    expect(wrapperTag(render(true, false))).toContain("data-split");
    expect(wrapperTag(render(false, false))).not.toContain("data-split");
  });

  it("is not a scroll region when its content fits", () => {
    const tag = wrapperTag(render(true, false));
    expect(tag).not.toContain("tabindex");
    expect(tag).not.toContain('role="region"');
    expect(tag).not.toContain("data-letter-scroll");
  });

  it("becomes a labelled, focusable region when its content overflows", () => {
    scroll.overflowing = true;
    const tag = wrapperTag(render(true, false));
    expect(tag).toContain('tabindex="0"');
    expect(tag).toContain('role="region"');
    expect(tag).toContain(`aria-label="${REVEAL_COPY.stage2Title}"`);
    expect(tag).toContain("data-letter-scroll");
  });

  it("passes still to the paper, so a settled letter does not unfold", () => {
    const settled = render(false, true);
    const unsettled = render(false, false);
    expect(settled).not.toEqual(unsettled);
    expect(settled).toContain("Body.");
  });
});
