// Feature: 10-own-questions (spec 10 C6.1, C6.3)
//
// The held Envelope's Seal_Group and seal layer at the Desktop_Sizes and the
// Wide_Size. The Seal_Group (hint, Seal_Button, Skip_Link) sits
// SEAL_GROUP_GAP_PX outside the Ghost_Body_Box edge facing the Content_Column,
// centred on the WaxSeal, so it shows at 1280x800, 1366x800 and 2560x1440. The
// seal's pointer target stays at least 44 by 44 px and sits on the flap (the
// drawn WaxSeal's centre, 55.3 %). These tests read the stylesheet and the
// width-class rule, because the test environment has no layout engine.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { sealPlacement } from "./seal-placement";

const sceneCss = readFileSync(
  join(__dirname, "..", "scene", "scene.module.css"),
  "utf8",
);

/** The three sizes the QA check names for the Seal_Group. */
const QA_DESKTOP_WIDTHS = [1280, 1366, 2560];

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1];
}

describe("held Envelope Seal_Group placement (spec 10 C6.3)", () => {
  const body = ruleBody(sceneCss, ".heldEnvelope [data-seal-group]");

  it("offsets the group from the Envelope by the SEAL_GROUP_GAP_PX gap", () => {
    expect(body).toMatch(
      /right:\s*calc\(109\.375%\s*\+\s*var\(--seal-group-gap\)\)/,
    );
    expect(body).toMatch(/--seal-group-gap:\s*20px/);
  });

  it("raises the group above the Ghost body with a positive z-index", () => {
    const match = body.match(/z-index:\s*(-?\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThan(0);
  });

  it("places the group at the WaxSeal's vertical centre", () => {
    expect(body).toMatch(/top:\s*55\.3%;/);
    expect(body).toMatch(/transform:\s*translateY\(-50%\);/);
  });

  it("lets the group take pointer events, so its button and link work", () => {
    expect(body).toMatch(/pointer-events:\s*auto;/);
  });

  it("no longer carries the retired instruction placement rule (C6.1)", () => {
    expect(sceneCss).not.toContain("[data-envelope-instruction]");
  });

  for (const viewportWidth of QA_DESKTOP_WIDTHS) {
    it(`puts the seal on the held Envelope at ${viewportWidth} px, so the Seal_Group is drawn there`, () => {
      expect(sealPlacement({ viewportWidth, slotReady: true })).toBe(
        "envelope",
      );
    });
  }
});

describe("held Envelope seal target (spec 10 C6.1; spec 09 C5.2)", () => {
  const sealBody = ruleBody(sceneCss, ".heldEnvelope [data-envelope-seal]");

  it("keeps the seal's pointer target at least 44 by 44 px", () => {
    expect(sealBody).toMatch(/min-width:\s*44px;/);
    expect(sealBody).toMatch(/min-height:\s*44px;/);
  });

  it("centres the seal on the flap (the drawn WaxSeal's centre)", () => {
    expect(sealBody).toMatch(/left:\s*50%;/);
    expect(sealBody).toMatch(/top:\s*55\.3%;/);
    expect(sealBody).toMatch(/transform:\s*translate\(-50%,\s*-50%\);/);
  });
});
