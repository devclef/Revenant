// Feature: 09-demo-polish (spec 09 C5.1, C5.2)
//
// The held Envelope's instruction line and seal layer at the Desktop_Sizes and
// the Wide_Size. The instruction must sit within 48 px of the Envelope and above
// the Ghost body, so its full text shows at 1280x800, 1366x800 and 2560x1440.
// The seal's pointer target stays at least 44 by 44 px. These tests read the
// stylesheet and the width-class rule, because the test environment has no
// layout engine.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { sealPlacement } from "./seal-placement";

const sceneCss = readFileSync(
  join(__dirname, "..", "scene", "scene.module.css"),
  "utf8",
);

/** The three sizes the QA check names for the instruction line. */
const QA_DESKTOP_WIDTHS = [1280, 1366, 2560];

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1];
}

/** The gap between the instruction's right edge and the Envelope, in px. */
function instructionGapPx(body: string): number {
  // The rule uses right: calc(100% + 1rem); 1rem is 16 px at the default root size.
  const match = body.match(/right:\s*calc\(100%\s*\+\s*([\d.]+)rem\)/);
  if (!match)
    throw new Error("instruction has no calc(100% + <n>rem) right offset");
  return Number(match[1]) * 16;
}

describe("held Envelope instruction placement (spec 09 C5.1)", () => {
  const body = ruleBody(sceneCss, ".heldEnvelope [data-envelope-instruction]");

  it("keeps the instruction within 48 px of the Envelope", () => {
    expect(instructionGapPx(body)).toBeLessThanOrEqual(48);
  });

  it("raises the instruction above the Ghost body with a positive z-index", () => {
    const match = body.match(/z-index:\s*(-?\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThan(0);
  });

  it("places the instruction at the Envelope's vertical centre", () => {
    expect(body).toMatch(/top:\s*50%;/);
    expect(body).toMatch(/transform:\s*translateY\(-50%\);/);
  });

  it("does not let the instruction take pointer events", () => {
    expect(body).toMatch(/pointer-events:\s*none;/);
  });

  for (const viewportWidth of QA_DESKTOP_WIDTHS) {
    it(`puts the seal on the held Envelope at ${viewportWidth} px, so the instruction is drawn there`, () => {
      expect(sealPlacement({ viewportWidth, slotReady: true })).toBe(
        "envelope",
      );
    });
  }
});

describe("held Envelope seal target (spec 09 C5.2)", () => {
  const sealBody = ruleBody(sceneCss, ".heldEnvelope [data-envelope-seal]");

  it("keeps the seal's pointer target at least 44 by 44 px", () => {
    expect(sealBody).toMatch(/min-width:\s*44px;/);
    expect(sealBody).toMatch(/min-height:\s*44px;/);
  });

  it("centres the seal on the Envelope", () => {
    expect(sealBody).toMatch(/left:\s*50%;/);
    expect(sealBody).toMatch(/top:\s*53%;/);
    expect(sealBody).toMatch(/transform:\s*translate\(-50%,\s*-50%\);/);
  });
});
