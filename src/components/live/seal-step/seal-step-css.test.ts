// Feature: 14-write-desk (spec 14, S3, S5 and S6).
//
// Reads seal-step.module.css and press.module.css and checks the S3, S5 and S6
// values. Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const stepCss = readFileSync(join(here, "seal-step.module.css"), "utf8");
const pressCss = readFileSync(
  join(here, "..", "press", "press.module.css"),
  "utf8",
);

/** Declarations of the first rule whose selector is exactly `selector`. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|[\\s},])${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return m ? m[1] : "";
}

describe("Seal step layout (spec 14, S3.1 and S3.2)", () => {
  it("fills the surface with 32 px side padding", () => {
    const body = ruleBody(stepCss, ".step");
    expect(body).toMatch(/inline-size:\s*100%;/);
    expect(body).toMatch(/padding:\s*32px;/);
  });

  it("uses two columns, 520 px and 64 px apart, from 900 px", () => {
    const media = /@media \(min-width: 900px\)\s*\{([\s\S]*?)\n\}/.exec(
      stepCss,
    );
    expect(media).not.toBeNull();
    const body = media?.[1] ?? "";
    expect(body).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*520px\)\s*minmax\(0,\s*1fr\);/,
    );
    expect(body).toMatch(/column-gap:\s*64px;/);
    expect(body).toMatch(/align-items:\s*center;/);
  });

  it("keeps the text column 520 px wide at most", () => {
    expect(ruleBody(stepCss, ".text")).toMatch(/max-width:\s*520px;/);
  });

  it("sets the heading to 48 px, weight 900, #ffffff and 1.05 line height", () => {
    const body = ruleBody(stepCss, ".heading");
    expect(body).toMatch(/font-size:\s*48px;/);
    expect(body).toMatch(/font-weight:\s*900;/);
    expect(body).toMatch(/letter-spacing:\s*-0\.03em;/);
    expect(body).toMatch(/line-height:\s*1\.05;/);
    expect(body).toMatch(/color:\s*#ffffff;/);
  });

  it("sets the body text to 17 px #bdb4dc at 1.5 line height (S3.3, S3.4)", () => {
    const body = ruleBody(stepCss, ".body");
    expect(body).toMatch(/font-size:\s*17px;/);
    expect(body).toMatch(/line-height:\s*1\.5;/);
    expect(body).toMatch(/color:\s*#bdb4dc;/);
  });

  it("paints the step on its own dark surface, not the paper panel (#0b0912)", () => {
    expect(ruleBody(stepCss, ".step")).toMatch(/background-color:\s*#0b0912;/);
  });
});

describe("Seal step links (spec 14, S5)", () => {
  it("sets the links to 13 px and the text controls to #bdb4dc with an underline", () => {
    expect(ruleBody(stepCss, ".links")).toMatch(/font-size:\s*13px;/);
    const link = ruleBody(stepCss, ".textLink");
    expect(link).toMatch(/color:\s*#bdb4dc;/);
    expect(link).toMatch(/text-decoration:\s*underline;/);
    expect(link).toMatch(/background:\s*transparent;/);
    expect(link).toMatch(/min-height:\s*24px;/);
  });

  it("dims a disabled Back link to 40 % and marks it not-allowed (S5.6)", () => {
    const body = ruleBody(stepCss, ".textLink:disabled");
    expect(body).toMatch(/opacity:\s*0\.4;/);
    expect(body).toMatch(/cursor:\s*not-allowed;/);
  });

  it("never colours the text controls orange", () => {
    expect(ruleBody(stepCss, ".textLink")).not.toMatch(/#ff7b1c/i);
  });
});

describe("Press_Envelope (spec 14, S6.1 to S6.5)", () => {
  it("sizes the envelope to min(440px, 100cqi) at aspect ratio 1.55", () => {
    const body = ruleBody(pressCss, ".press");
    expect(body).toMatch(/width:\s*min\(440px,\s*100cqi\);/);
    expect(body).toMatch(/aspect-ratio:\s*1\.55;/);
  });

  it("paints the envelope #f1e4c8 with 6 px corners and the S6.1 shadow", () => {
    const body = ruleBody(pressCss, ".envelope");
    expect(body).toMatch(/background-color:\s*#f1e4c8;/);
    expect(body).toMatch(/border-radius:\s*6px;/);
    expect(body).toMatch(
      /box-shadow:\s*0 40px 90px rgba\(0,\s*0,\s*0,\s*0\.6\);/,
    );
  });

  it("draws the flap as a #e6d5b2 triangle whose point lies at 58 %", () => {
    const body = ruleBody(pressCss, ".flap");
    expect(body).toMatch(/background-color:\s*#e6d5b2;/);
    expect(body).toMatch(/clip-path:\s*polygon\(0 0,\s*100% 0,\s*50% 58%\);/);
  });

  it("scales the wax to 112 px at 440 px and centres it on the flap point", () => {
    const body = ruleBody(pressCss, ".wax");
    expect(body).toMatch(
      /width:\s*calc\(\s*44px \+ \(min\(440px,\s*100cqi\) \* 112 \/ 440 - 44px\) \* var\(--press-progress\)\s*\);/,
    );
    expect(body).toMatch(/top:\s*58%;/);
    expect(body).toMatch(/left:\s*50%;/);
  });

  it("dims the unready seal to 35 % and marks it not-allowed (spec 15, task 9)", () => {
    expect(ruleBody(pressCss, '.press[aria-disabled="true"] .wax')).toMatch(
      /opacity:\s*0\.35;/,
    );
    expect(ruleBody(pressCss, '.press[aria-disabled="true"]')).toMatch(
      /cursor:\s*not-allowed;/,
    );
  });

  it("draws the double orange halo only when ready, and drops it for reduced motion and Calm", () => {
    expect(ruleBody(pressCss, ".press[data-ready] .wax")).toMatch(
      /box-shadow:/,
    );
    expect(pressCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.press\[data-ready\] \.wax\s*\{\s*box-shadow:\s*none;/,
    );
    expect(
      ruleBody(pressCss, ":root[data-calm] .press[data-ready] .wax"),
    ).toMatch(/box-shadow:\s*none;/);
  });

  it("keeps the status line on the dark surface, muted #bdb4dc or accent #ff9a4d", () => {
    expect(ruleBody(pressCss, '.line[data-tone="muted"]')).toMatch(
      /color:\s*#bdb4dc;/,
    );
    expect(ruleBody(pressCss, '.line[data-tone="accent"]')).toMatch(
      /color:\s*#ff9a4d;/,
    );
  });
});

describe("Seal step intro block (spec 16, task 12, from 900 px)", () => {
  const stepTsx = readFileSync(join(here, "SealStep.tsx"), "utf8");
  const mediaBody =
    /@media \(min-width: 900px\)\s*\{([\s\S]*?)\n\}/.exec(stepCss)?.[1] ?? "";

  it("finds the warning in the spanning intro block from 900 px", () => {
    expect(mediaBody).toMatch(/\.intro\s*\{[^}]*grid-column:\s*1 \/ -1;/);
    const intro = stepTsx.indexOf('data-seal-intro=""');
    const text = stepTsx.indexOf('data-seal-text=""');
    expect(intro).toBeGreaterThan(-1);
    expect(text).toBeGreaterThan(intro);
    const introBlock = stepTsx.slice(intro, text);
    expect(introBlock).toContain('data-warning-text=""');
    expect(introBlock).toContain("data-step-heading");
    expect(introBlock).toContain("LIVE_COPY.sealParagraph");
  });

  it("puts no disclosure around the warning", () => {
    const intro = stepTsx.indexOf('data-seal-intro=""');
    const text = stepTsx.indexOf('data-seal-text=""');
    expect(stepTsx.slice(intro, text)).not.toMatch(/<details|<summary/);
  });

  it("keeps the single column below 900 px", () => {
    expect(ruleBody(stepCss, ".step")).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
  });
});

// Feature: 20-easier-sealing-and-receipts (Part C). The Seal_Button is 2.75rem
// square at least, and the Back link, the PRF fallback and the Backup_Choice
// cards carry no accent colour in their resting state. Orange is kept for the
// focus ring and the selected card (tone.md).
describe("Seal_Button size and accent-free controls (spec 20, Part C)", () => {
  const backupCss = readFileSync(
    join(here, "..", "backup-choice.module.css"),
    "utf8",
  );
  const ORANGE = /#ff7b1c|rgba\(255,\s*123,\s*28/i;

  it("sizes the Seal_Button to at least 2.75rem in both directions", () => {
    const body = ruleBody(stepCss, ".sealButton");
    expect(body).toMatch(/min-block-size:\s*2\.75rem;/);
    expect(body).toMatch(/min-inline-size:\s*2\.75rem;/);
  });

  it("gives the Back link no accent colour at rest", () => {
    expect(ruleBody(stepCss, ".textLink")).not.toMatch(ORANGE);
    expect(ruleBody(stepCss, ".links")).not.toMatch(ORANGE);
  });

  it("gives the PRF fallback button no accent colour at rest", () => {
    expect(ruleBody(stepCss, ".fallback")).not.toMatch(ORANGE);
  });

  it("gives the Backup_Choice cards no accent colour at rest", () => {
    expect(ruleBody(backupCss, ".card")).not.toMatch(ORANGE);
    expect(ruleBody(backupCss, ".title")).not.toMatch(ORANGE);
    expect(ruleBody(backupCss, ".help")).not.toMatch(ORANGE);
  });

  it("keeps the orange on the focus rings of the links and the fallback button", () => {
    expect(ruleBody(stepCss, ".textLink:focus-visible")).toMatch(/#ff7b1c/i);
    expect(ruleBody(stepCss, ".fallback:focus-visible")).toMatch(/#ff7b1c/i);
  });
});
