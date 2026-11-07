// Feature: 09 spec, L7 and L8 (issue #265): the Light_Shaft's Calm path and the
// two paper creases.
//
// - The shaft is static under Calm (the Calm control) and reduced motion. The
//   layout effect starts no animation, and the markup says `data-light="static"`.
// - The creases sit at 1/3 and 2/3 of the paper height, full width, aria-hidden,
//   and outside the article so the paper still holds the Letter_Text alone.
// - The scene's light is a shaft, not a solid purple slab, and the receipts
//   column is plain dark.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CREASE_POSITIONS, SHAFT_PHONE_BAND_MAX_PX } from "../constants";
import { LetterBlock } from "./LetterBlock";
import { MotionProvider } from "../motion";
import type { Opened } from "@/components/reveal/opening-machine";
import type { PayloadV1 } from "@/lib/seal-format";

type Mode = "full" | "light" | "calm";
let currentMode: Mode = "full";

vi.mock("../motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../motion")>();
  return {
    ...actual,
    useMotion: () => ({ mode: currentMode, setCalm: vi.fn() }),
  };
});

const HERE = __dirname;
const CEREMONY_DIR = join(HERE, "..");
const SCENE_CSS = readFileSync(join(CEREMONY_DIR, "scene", "scene.module.css"), "utf8");
const LETTER_CSS = readFileSync(join(HERE, "LetterBlock.module.css"), "utf8");
const REVEAL_CSS = readFileSync(join(CEREMONY_DIR, "..", "reveal", "reveal.module.css"), "utf8");

/** A stylesheet with its comments removed, so prose cannot match a rule. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The declaration block of the first rule whose selector is exactly `.name`. */
function blockOf(css: string, name: string): string {
  const match = new RegExp(`(^|\\n)\\.${name}\\s*\\{([^}]*)\\}`).exec(withoutComments(css));
  if (match === null) throw new Error(`no rule for .${name}`);
  return match[2] ?? "";
}

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
  } as unknown as PayloadV1;
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
  } as unknown as Opened;
}

function render(mode: Mode): string {
  currentMode = mode;
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(LetterBlock, {
        opened: openedWith("A short letter."),
        personaName: "Maya",
      }),
    ),
  );
}

beforeEach(() => {
  currentMode = "full";
});

describe("Light_Shaft Calm path (spec 09 L7)", () => {
  it("is static under Calm: the markup marks it static, so nothing unfolds it", () => {
    const html = render("calm");
    expect(html).toMatch(/data-light-shaft=""[^>]*data-light="static"|data-light="static"[^>]*data-light-shaft=""/);
  });

  it("is static under light motion too", () => {
    expect(render("light")).toMatch(/data-light="static"/);
  });

  it("animates only in full motion, where the shaft moves with the unfold", () => {
    expect(render("full")).toMatch(/data-light="unfold"/);
  });

  it("is aria-hidden, and it sits before the paper in document order", () => {
    const html = render("full");
    const shaft = /<div[^>]*data-light-shaft=""[^>]*>/.exec(html)?.[0] ?? "";
    expect(shaft).toMatch(/aria-hidden="true"/);
    expect(html.indexOf("data-light-shaft")).toBeLessThan(html.indexOf("<article"));
  });

  it("is a gradient with transform and opacity only, with no solid fill (no slab)", () => {
    const shaft = blockOf(LETTER_CSS, "lightShaft");
    expect(shaft).toMatch(/linear-gradient/);
    expect(shaft).not.toMatch(/background-color:\s*rgba?\(|background-color:\s*#/);
    expect(shaft).toMatch(new RegExp(`height:\\s*${SHAFT_PHONE_BAND_MAX_PX}px`));
  });
});

describe("paper creases (spec 09 L8)", () => {
  it("are two, at 1/3 and 2/3 of the paper height, full width and aria-hidden", () => {
    expect(CREASE_POSITIONS).toEqual([1 / 3, 2 / 3]);
    const html = render("full");
    const creases = [...html.matchAll(/<div[^>]*data-crease="(\d)"[^>]*>/g)].map((m) => m[0]);
    expect(creases).toHaveLength(2);
    expect(creases[0]).toContain('style="top:33.3333%"');
    expect(creases[1]).toContain('style="top:66.6667%"');
    for (const crease of creases) expect(crease).toMatch(/aria-hidden="true"/);
  });

  it("sit outside the article, so the paper still holds only the letter text", () => {
    const html = render("full");
    const article = /<article[^>]*>([\s\S]*?)<\/article>/.exec(html);
    expect(article).not.toBeNull();
    expect(article?.[1]).not.toMatch(/data-crease/);
    expect(article?.[1]).toMatch(/data-letter-text/);
  });

  it("are full width in the stylesheet, with no fill", () => {
    const crease = blockOf(LETTER_CSS, "crease");
    expect(crease).toMatch(/left:\s*0/);
    expect(crease).toMatch(/right:\s*0/);
    expect(crease).not.toMatch(/background/);
  });
});

describe("the scene light and the receipts column (spec 09 L7)", () => {
  it("is a shaft, not a solid purple disk: no closest-side fill, no animation", () => {
    const light = blockOf(SCENE_CSS, "light");
    expect(light).not.toMatch(/closest-side/);
    expect(light).toMatch(/radial-gradient\(ellipse/);
    expect(light).not.toMatch(/animation|transition/);
  });

  it("the receipts column is plain dark, the desk background with no purple", () => {
    expect(blockOf(REVEAL_CSS, "figureGroup")).toMatch(/background-color:\s*var\(--bg\)/);
    expect(withoutComments(REVEAL_CSS)).not.toMatch(/var\(--purple\)/);
  });
});
