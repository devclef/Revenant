import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { LetterBlock } from "./LetterBlock";
import { MotionProvider } from "../motion";
import { REVEAL_COPY, LIVE_COPY } from "@/components/reveal/copy";
import { formatCalendarDate } from "@/components/ui/letter-date";
import type { Opened } from "@/components/reveal/opening-machine";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * Spec 07 task 5: the letter stage (`LetterBlock`, R13).
 *
 * Property 17 (fast-check, at least 100 runs, 1 to 5,000 code points): the
 * letter text appears exactly once, as the only child text of one paragraph,
 * with the labels before it and no element inside the paragraph. No style
 * touches `mask`, `clip` or the text's opacity.
 *
 * Property 23 (strings, for this block): the strings the block renders carry
 * no "!", no Scoring_Words_Always word, no Scene_Copy scoring word, and no
 * sentence over 25 words.
 */

const HERE = __dirname;
const REVEAL_DIR = join(HERE, "..", "..", "reveal");

const PERSONA_NAME = "Maya";

function openedWith(letterText: string): Opened {
  const payload: PayloadV1 = {
    format_version: 1,
    letter_text: letterText,
    written_as_of: "2024-10-15",
    metrics: [
      {
        id: "fuel",
        display_name: "Regular gasoline",
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
      },
    ],
    figures: [
      {
        kind: "official",
        metric_id: "fuel",
        value: "3.412",
        unit: "USD per gallon",
        region: "U.S. city average",
        period: "2024-10",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
        retrieved_at: "2024-10-30T14:02:11Z",
        source_url: "https://www.eia.gov/fixture",
      },
    ],
    recall_questions: [
      {
        id: "q-fuel",
        answer_type: "number",
        text: "What do you think a gallon of regular gasoline cost then?",
        metric_id: "fuel",
      },
    ],
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

function render(letterText: string, caption?: string): string {
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(LetterBlock, {
        opened: openedWith(letterText),
        personaName: PERSONA_NAME,
        caption:
          caption === undefined
            ? undefined
            : createElement("span", { "data-caption-slot": "" }, "verdict"),
      }),
    ),
  );
}

/** A stylesheet with its comments removed, so prose cannot match a rule. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The letter as renderToStaticMarkup writes it as a bare text child. */
function escapedText(letterText: string): string {
  const encoded = renderToStaticMarkup(createElement("p", null, letterText));
  return encoded.slice("<p>".length, -"</p>".length);
}

/** The declaration block of the first rule whose selector is exactly `.name`. */
function blockOf(css: string, name: string): string {
  const match = new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css);
  if (match === null) throw new Error(`no rule for .${name}`);
  return match[1] ?? "";
}

// Code points from the whole Unicode range, plus the characters that the
// markup has to escape or that break lines.
// The surrogate block (0xD800 to 0xDFFF) is skipped: it is not a code point.
const codePoint = fc.oneof(
  fc.integer({ min: 0x00, max: 0xd7ff }),
  fc.integer({ min: 0xe000, max: 0x10ffff }),
  fc.constantFrom(0x0a, 0x0d, 0x09, 0x20, 0x3c, 0x3e, 0x26, 0x22, 0x27),
);
const letterText = fc
  .array(codePoint, { minLength: 1, maxLength: 5000 })
  .map((points) => String.fromCodePoint(...points));

describe("Property 17: the letter is shown verbatim with nothing against it (R13.3, R13.4, R13.7)", () => {
  it("shows any 1 to 5,000 code point letter once, as the only text of one paragraph", () => {
    fc.assert(
      fc.property(letterText, (text) => {
        const html = render(text);
        const inner = escapedText(text);

        // Exactly one paragraph holds the text, and it holds nothing else.
        const plainParagraphs = [...html.matchAll(/<p[^>]*>([^<]*)<\/p>/g)].map(
          (match) => match[1],
        );
        expect(plainParagraphs.filter((content) => content === inner)).toHaveLength(1);

        // The labels come before the letter paragraph.
        const heading = html.indexOf(REVEAL_COPY.stage2Title);
        const paragraph = html.indexOf(`>${inner}</p>`);
        expect(heading).toBeGreaterThanOrEqual(0);
        expect(paragraph).toBeGreaterThan(heading);
      }),
      { numRuns: 100 },
    );
  });

  it("applies no mask, clip or opacity to the letter (R13.4)", () => {
    const blockCss = readFileSync(join(HERE, "LetterBlock.module.css"), "utf8");
    const revealCss = readFileSync(join(REVEAL_DIR, "reveal.module.css"), "utf8");
    expect(withoutComments(blockCss)).not.toMatch(/mask|clip/);
    // Opacity is allowed on the decorative shaft and creases, which sit outside
    // the article. The letter's own rules must carry none of the three.
    expect(blockOf(withoutComments(blockCss), "paper")).not.toMatch(/mask|clip|opacity/);
    expect(blockOf(withoutComments(blockCss), "letterBlock")).not.toMatch(/mask|clip|opacity/);
    const letterRule = blockOf(withoutComments(revealCss), "letter");
    expect(letterRule).not.toMatch(/mask|clip|opacity/);
  });

  it("holds only the letter text in the article; creases and the shaft sit outside it (L6.1, L8)", () => {
    const html = render("A short letter.");
    const paper = /<article[^>]*>([\s\S]*?)<\/article>/.exec(html);
    expect(paper).not.toBeNull();
    // The paper's only child is the Letter_Text paragraph: no crease, no label.
    expect(paper?.[1]).toMatch(/^<p class="[^"]*" data-letter-text="">A short letter\.<\/p>$/);
    expect(paper?.[1]).not.toContain("aria-hidden");
  });

  it("puts the Caption_Block before the paper, with the heading, labels and caption content in it (L6.2, L6.4)", () => {
    const html = render("A short letter.", "verdict");
    const headerStart = html.indexOf("<header");
    const headerEnd = html.indexOf("</header>");
    const paperStart = html.indexOf("<article");
    expect(headerStart).toBeGreaterThanOrEqual(0);
    expect(headerEnd).toBeGreaterThan(headerStart);
    expect(paperStart).toBeGreaterThan(headerEnd);

    const caption = html.slice(headerStart, headerEnd);
    // The Caption_Block h2 carries data-letter-heading (spec 10 C6, the
    // no-figures Skip focus target), so match on the heading text, not an
    // exact attribute list.
    const heading = caption.search(
      new RegExp(`<h2[^>]*>${REVEAL_COPY.stage2Title}</h2>`),
    );
    const disclosure = caption.indexOf(
      REVEAL_COPY.letterDisclosure
        .replace("{name}", PERSONA_NAME)
        .replace("{writtenAsOf}", formatCalendarDate("2024-10-15")),
    );
    const sealed = caption.indexOf(REVEAL_COPY.sealedForThisDemo.split("{")[0]);
    const slot = caption.indexOf("data-caption-slot");
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(disclosure).toBeGreaterThan(heading);
    expect(sealed).toBeGreaterThan(disclosure);
    expect(slot).toBeGreaterThan(sealed);
    // The letter text is not inside the caption.
    expect(caption).not.toContain("A short letter.");
  });

  it("has no solid purple slab, and its creases are horizontal hairlines (L7.1, L8.1)", () => {
    const css = withoutComments(readFileSync(join(HERE, "LetterBlock.module.css"), "utf8"));
    expect(blockOf(css, "letterBlock")).not.toMatch(/background/);
    // The shaft is a gradient with no literal fill.
    const shaft = blockOf(css, "lightShaft");
    expect(shaft).toMatch(/linear-gradient/);
    expect(shaft).not.toMatch(/background-color/);
    expect(css).not.toMatch(/#8f46ff|143,\s*70,\s*255/i);
    // A crease is one full-width horizontal line: zero height, no vertical extent.
    const crease = blockOf(css, "crease");
    expect(crease).toMatch(/height:\s*0/);
    expect(crease).toMatch(/left:\s*0/);
    expect(crease).toMatch(/right:\s*0/);
  });

  it("gives the caption its own light focus ring, not a white ring inside a purple block (L6.2)", () => {
    const css = withoutComments(readFileSync(join(HERE, "LetterBlock.module.css"), "utf8"));
    expect(css).toMatch(/\.caption :focus-visible\s*\{[^}]*outline:\s*2px solid var\(--text/);
    expect(css).not.toMatch(/#ffffff/i);
  });


  it("keeps the letter as one text node with white-space: pre-wrap", () => {
    const revealCss = withoutComments(readFileSync(join(REVEAL_DIR, "reveal.module.css"), "utf8"));
    expect(blockOf(revealCss, "letter")).toMatch(/white-space:\s*pre-wrap/);
    const html = render("Line one.\nLine two.");
    expect(html.match(/<p[^>]*>Line one\.\nLine two\.<\/p>/)).not.toBeNull();
  });

  it("unfolds only in full motion, through a Web Animation with fill backwards", () => {
    const source = readFileSync(join(HERE, "LetterBlock.tsx"), "utf8");
    expect(source).toContain('mode !== "full"');
    expect(source).toContain('fill: "backwards"');
    expect(source).toContain("UNFOLD_AT_MS");
    expect(source).toContain("UNFOLD_MS");
  });
});

// --- Property 23: strings for LetterBlock --------------------------------------

const SCORING_WORDS_ALWAYS = ["accuracy", "score", "off by"];
const SCORING_WORDS_SCENE = ["close", "right", "wrong"];
const MAX_SENTENCE_WORDS = 25;

const BLOCK_STRINGS: Record<string, string> = {
  stage2Title: REVEAL_COPY.stage2Title,
  stage2Next: REVEAL_COPY.stage2Next,
  showAll: REVEAL_COPY.showAll,
  writtenAsOfPrefix: REVEAL_COPY.writtenAsOfPrefix,
  demoLetterLabel: REVEAL_COPY.demoLetterLabel,
  sealedForThisDemo: REVEAL_COPY.sealedForThisDemo,
  letterDisclosure: REVEAL_COPY.letterDisclosure,
  liveSealedOn: LIVE_COPY.sealedOn,
};

describe("Property 23: strings for LetterBlock (copy checks)", () => {
  for (const [name, value] of Object.entries(BLOCK_STRINGS)) {
    it(`${name} has no "!", no scoring word, and no sentence over 25 words`, () => {
      expect(value, name).not.toContain("!");
      for (const word of SCORING_WORDS_ALWAYS) {
        expect(new RegExp(`\\b${word}\\b`, "i").test(value), `${name}: ${word}`).toBe(false);
      }
      for (const word of SCORING_WORDS_SCENE) {
        expect(new RegExp(`\\b${word}\\b`, "i").test(value), `${name}: ${word}`).toBe(false);
      }
      for (const sentence of value.split(/[.?]\s*/)) {
        const words = sentence.trim().split(/\s+/).filter((w) => w.length > 0);
        expect(words.length, `${name}: "${sentence}"`).toBeLessThanOrEqual(MAX_SENTENCE_WORDS);
      }
    });
  }

  it("renders the stage heading and the demo label as they are in copy", () => {
    const html = render("Body.");
    expect(html).toContain(REVEAL_COPY.stage2Title);
    expect(html).toContain(
      REVEAL_COPY.letterDisclosure
        .replace("{name}", PERSONA_NAME)
        .replace("{writtenAsOf}", formatCalendarDate("2024-10-15")),
    );
  });
});

// --- The user-content marker on the Letter_Text paragraph (#300) -------------

describe("the Letter_Text paragraph marker by letter kind", () => {
  function renderKind(letterKind?: "persona" | "live" | "real"): string {
    return renderToStaticMarkup(
      createElement(
        MotionProvider,
        null,
        createElement(LetterBlock, {
          opened: openedWith("Dear me, the rent is due."),
          personaName: PERSONA_NAME,
          letterKind,
        }),
      ),
    );
  }

  /** The opening tag of the Letter_Text paragraph. */
  function letterTextTag(html: string): string {
    const match = /<p [^>]*data-letter-text=""[^>]*>/.exec(html);
    if (match === null) throw new Error("no Letter_Text paragraph");
    return match[0];
  }

  it("marks a live letter's Letter_Text paragraph with data-user-content", () => {
    expect(letterTextTag(renderKind("live"))).toContain('data-user-content=""');
  });

  it("marks a real letter's Letter_Text paragraph with data-user-content", () => {
    expect(letterTextTag(renderKind("real"))).toContain('data-user-content=""');
  });

  it("leaves data-user-content off a persona letter's Letter_Text paragraph", () => {
    expect(letterTextTag(renderKind("persona"))).not.toContain("data-user-content");
  });

  it("treats a letter with no kind as a persona letter, so the marker is off", () => {
    expect(letterTextTag(renderKind())).not.toContain("data-user-content");
  });
});
