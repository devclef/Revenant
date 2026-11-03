// Feature: 07-judge-journey (spec 07 task 4, issue #166)
//
// The "Opens {date}" line must render in full at 360 px without clipping. Each
// date stays on one line (nowrap), and its font shrinks to the width of the
// `.lines` box through container query units. The envelope's seal side and its
// horizontal placement are unchanged: the frame still centres with auto margins.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const envelopeCss = readFileSync(resolve(__dirname, "Envelope.module.css"), "utf8");
const viewCss = readFileSync(resolve(__dirname, "EnvelopeView.module.css"), "utf8");

function bodyOf(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return m?.[1] ?? "";
}

const REM_PX = 16;
const SMALLEST_VIEWPORT_PX = 360;
const LINES_SHARE = 0.84; // .lines spans 8% to 92% of the front
const FRONT_WIDTH_SHARE = 0.84; // envelope width is min(84vw, 26rem)

describe("date lines fit one line each at 360 px", () => {
  it("keeps each date on one line with nowrap", () => {
    expect(bodyOf(envelopeCss, ".date")).toMatch(/white-space:\s*nowrap/);
  });

  it("makes the .lines box a size container so cqi units resolve against it", () => {
    expect(bodyOf(envelopeCss, ".lines")).toMatch(/container-type:\s*inline-size/);
  });

  it("shrinks the date font to the .lines width, not only the clamp", () => {
    const font = bodyOf(envelopeCss, ".date").match(/font-size:\s*min\(([^)]*\)[^)]*)\)/);
    expect(font).not.toBeNull();
    expect(font![1]).toMatch(/cqi/);
    expect(font![1]).toMatch(/clamp\(0\.85rem/);
  });

  it("fits the longest date within the .lines box at 360 px", () => {
    // The clamp minimum (0.85rem) is the font at 360 px. The longest line,
    // "Written as of 12 September 2024", is 31 characters at a conservative
    // 0.6 em average glyph width.
    const fontPx = 0.85 * REM_PX;
    const longest = "Written as of 12 September 2024".length;
    const textWidthPx = longest * 0.6 * fontPx;
    const frontWidthPx = FRONT_WIDTH_SHARE * SMALLEST_VIEWPORT_PX;
    const linesWidthPx = LINES_SHARE * frontWidthPx;
    expect(textWidthPx).toBeLessThanOrEqual(linesWidthPx);
  });
});

describe("the envelope keeps its seal side and horizontal placement", () => {
  it("still centres the frame with auto side margins", () => {
    const body = bodyOf(viewCss, ".frame");
    expect(body).toMatch(/margin-left:\s*auto/);
    expect(body).toMatch(/margin-right:\s*auto/);
  });

  it("keeps the envelope's horizontal anchor (left:8%, right:8%) for the lines", () => {
    const body = bodyOf(envelopeCss, ".lines");
    expect(body).toMatch(/left:\s*8%/);
    expect(body).toMatch(/right:\s*8%/);
  });
});
