// Spec 10 C7.2 and C7.3: no Stage card is more than 48 px taller than its
// content, and each control sits within 48 px of what it acts on.
//
// These are CSS rule tests. They read the module CSS and check the values the
// rules set, then compute the empty space a card shows above and below its
// children (its padding and border, plus any margin on the first or last child).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = __dirname;
const MAX_EMPTY_PX = 48;
const REM_PX = 16;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(
    new RegExp(`(?:^|[\\s,}])${escaped}\\s*\\{([^}]*)\\}`),
  );
  if (match === null) throw new Error(`no rule for ${selector}`);
  return match[1];
}

/** Evaluates clamp(min, preferred, max) with 1 rem = 16 px and vw = viewport px. */
function clampPx(expr: string, viewportPx: number): number {
  const m = expr.trim().match(/^clamp\((.+)\)$/);
  if (m === null) throw new Error(`not a clamp(): ${expr}`);
  const [lo, mid, hi] = m[1].split(",").map((t) => t.trim());
  const toPx = (term: string, preferred: boolean): number => {
    if (term.endsWith("vw")) return (parseFloat(term) / 100) * viewportPx;
    if (term.endsWith("rem")) return parseFloat(term) * REM_PX;
    if (preferred) throw new Error(`unsupported term ${term}`);
    return parseFloat(term);
  };
  return Math.min(toPx(hi, false), Math.max(toPx(lo, false), toPx(mid, true)));
}

const letterBlock = stripComments(
  readFileSync(resolve(here, "LetterBlock.module.css"), "utf8"),
);
const close = stripComments(
  readFileSync(resolve(here, "../close/close.module.css"), "utf8"),
);

describe("LetterBlock paper (C7.3)", () => {
  it("sets the desktop paper padding to clamp(1rem, 3vw, 1.5rem)", () => {
    expect(letterBlock).toMatch(/--paper-pad: clamp\(1rem, 3vw, 1\.5rem\);/);
  });

  it("keeps the narrow paper padding at 0.875rem", () => {
    expect(letterBlock).toMatch(/--paper-pad: 0\.875rem;/);
  });

  it("zeroes the Letter_Text paragraph margin inside the paper", () => {
    expect(ruleBody(letterBlock, ".paper > p")).toMatch(/margin:\s*0;/);
  });

  it.each([360, 600, 900, 1200, 1280, 1366, 1600, 2560])(
    "leaves at most 48 px of empty paper above and below the letter at %i px",
    (viewportPx) => {
      expect(ruleBody(letterBlock, ".paper")).toMatch(
        /padding:\s*var\(--paper-pad\);/,
      );
      // The paragraph margin is zero (tested above) and the paper has no border,
      // so the empty space is the top and bottom padding alone.
      const pad =
        viewportPx < 600
          ? 0.875 * REM_PX
          : clampPx("clamp(1rem, 3vw, 1.5rem)", viewportPx);
      expect(2 * pad).toBeLessThanOrEqual(MAX_EMPTY_PX);
    },
  );
});

describe("Close card (C7.3)", () => {
  it("keeps the top and bottom padding plus the 1 px border within 48 px", () => {
    const body = ruleBody(close, ".close");
    const padding = body.match(/padding:\s*([\d.]+)rem\s+[\d.]+rem;/);
    const border = body.match(/border:\s*(\d+)px solid/);
    expect(padding).not.toBeNull();
    expect(border).not.toBeNull();
    const emptyPx =
      2 * parseFloat(padding![1]) * REM_PX + 2 * parseFloat(border![1]);
    expect(emptyPx).toBeLessThanOrEqual(MAX_EMPTY_PX);
  });
});

describe("Close controls next to what they act on (C7.2)", () => {
  it("sets the Close controls in a column with a 1 rem gap and 44 px targets", () => {
    expect(ruleBody(close, ".close")).toMatch(/gap:\s*1rem;/);
    expect(ruleBody(close, ".cta")).toMatch(/min-height:\s*44px;/);
    expect(ruleBody(close, ".quietLink")).toMatch(/min-height:\s*44px;/);
  });
});

describe("Letter controls next to what they act on (C7.2)", () => {
  it("puts the letter caption 1 rem above the paper, within 48 px", () => {
    expect(ruleBody(letterBlock, ".caption")).toMatch(/margin:\s*0 0 1rem;/);
  });

  it("puts the phone letter disclosure summary directly on the paper, with no gap", () => {
    expect(ruleBody(letterBlock, ".sheet")).not.toMatch(/margin/);
    expect(ruleBody(letterBlock, ".letterDisclosure > summary")).toMatch(
      /min-height:\s*44px;/,
    );
  });
});

describe("No Stage renders a card of controls only (C7.3)", () => {
  it("never imports StagePanel from a Stage, so its paper padding cannot hold a control-only card", () => {
    const stageFiles = [
      "../../reveal/Reveal.tsx",
      "../../reveal/SealedLetter.tsx",
      "../../reveal/FiguresThenNow.tsx",
      "../close/Close.tsx",
      "./LetterBlock.tsx",
      "../figures/FiguresFadeUp.tsx",
    ];
    for (const rel of stageFiles) {
      const src = readFileSync(resolve(here, rel), "utf8");
      expect(src).not.toMatch(/StagePanel/);
    }
  });
});
