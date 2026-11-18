// Feature: 14-write-desk, S4 (Backup_Cards). Reads backup-choice.module.css and
// checks the S4 values: card geometry, the selected, focus and disabled looks,
// and the hidden radio. Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "backup-choice.module.css"), "utf8");
const liveCss = readFileSync(join(here, "live.module.css"), "utf8");

/** Declarations of the first rule whose selector is exactly `selector`. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|[\\s},])${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return m ? m[1] : "";
}

describe("Backup_Card base look (S4.1, S4.3)", () => {
  it("lays the card out as a 18 px circle column and a text column with 12 px between", () => {
    const body = ruleBody(".card");
    expect(body).toMatch(/display:\s*grid;/);
    expect(body).toMatch(/grid-template-columns:\s*18px 1fr;/);
    expect(body).toMatch(/column-gap:\s*12px;/);
  });

  it("uses 16 px by 18 px padding, 10 px radius, and the base border and background", () => {
    const body = ruleBody(".card");
    expect(body).toMatch(/padding:\s*16px 18px;/);
    expect(body).toMatch(/border-radius:\s*10px;/);
    expect(body).toMatch(/border:\s*1px solid #2a2340;/);
    expect(body).toMatch(/background:\s*#15111f;/);
  });

  it("sets the 18 px circle with a 1.5 px #6d6488 ring", () => {
    const body = ruleBody(".circle");
    expect(body).toMatch(/width:\s*18px;/);
    expect(body).toMatch(/height:\s*18px;/);
    expect(body).toMatch(/border:\s*1\.5px solid #6d6488;/);
    expect(body).toMatch(/border-radius:\s*50%;/);
  });

  it("sets the title at 15 px weight 600 and the help line at 13 px #bdb4dc in column 2", () => {
    const title = ruleBody(".title");
    expect(title).toMatch(/font-size:\s*15px;/);
    expect(title).toMatch(/font-weight:\s*600;/);
    expect(title).toMatch(/color:\s*#ffffff;/);
    const help = ruleBody(".help");
    expect(help).toMatch(/font-size:\s*13px;/);
    expect(help).toMatch(/color:\s*#bdb4dc;/);
    expect(help).toMatch(/grid-column:\s*2;/);
  });

  it("sets the legend at 15 px weight 700 in white", () => {
    const body = ruleBody(".legend");
    expect(body).toMatch(/font-size:\s*15px;/);
    expect(body).toMatch(/font-weight:\s*700;/);
    expect(body).toMatch(/color:\s*#ffffff;/);
  });

  it("stacks the cards in a flex column with 10 px between them", () => {
    const body = ruleBody(".cards");
    expect(body).toMatch(/display:\s*flex;/);
    expect(body).toMatch(/flex-direction:\s*column;/);
    expect(body).toMatch(/gap:\s*10px;/);
  });
});

describe("Backup_Card selected look (S4.4)", () => {
  it("draws the selected card border in #ff7b1c", () => {
    expect(ruleBody(".card:has(.radio:checked)")).toMatch(
      /border-color:\s*#ff7b1c;/,
    );
  });

  it("tints the selected card with rgba(255,123,28,.10) over the card base", () => {
    const body = ruleBody(".card:has(.radio:checked)");
    expect(body).toMatch(/rgba\(255,\s*123,\s*28,\s*0\.1\)/);
    expect(body).toMatch(/#15111f/);
  });

  it("fills the circle in #ff7b1c and shows an inner #0b0912 dot", () => {
    expect(ruleBody(".card:has(.radio:checked) .circle")).toMatch(
      /background:\s*#ff7b1c;/,
    );
    expect(ruleBody(".circle::after")).toMatch(/background:\s*#0b0912;/);
    expect(ruleBody(".card:has(.radio:checked) .circle::after")).toMatch(
      /display:\s*block;/,
    );
  });
});

describe("Backup_Card focus and disabled looks (S4.6, S4.7)", () => {
  it("draws a 2 px #ff7b1c outline with a 2 px offset on keyboard focus", () => {
    const body = ruleBody(".card:has(.radio:focus-visible)");
    expect(body).toMatch(/outline:\s*2px solid #ff7b1c;/);
    expect(body).toMatch(/outline-offset:\s*2px;/);
  });

  it("shows not-allowed on a disabled card and keeps the checked look", () => {
    expect(ruleBody(".card:has(.radio:disabled)")).toMatch(
      /cursor:\s*not-allowed;/,
    );
    expect(ruleBody(".card:has(.radio:checked)")).toMatch(
      /border-color:\s*#ff7b1c;/,
    );
  });
});

describe("the native radio stays focusable but is not drawn (S4.2)", () => {
  it("uses the clip pattern rather than display:none, so keyboard focus still works", () => {
    const body = ruleBody(".radio");
    expect(body).toMatch(/position:\s*absolute;/);
    expect(body).toMatch(/clip:\s*rect\(0 0 0 0\);/);
    expect(body).toMatch(/clip-path:\s*inset\(50%\);/);
    expect(body).not.toMatch(/display:\s*none/);
  });
});

describe("the .backupChoice rules moved out of live.module.css", () => {
  it("no longer defines the old backupChoice classes or the old radio rule there", () => {
    expect(liveCss).not.toMatch(/\.backupChoice[A-Za-z]*\s*\{/);
    expect(liveCss).not.toMatch(/\n\.radio\s*\{/);
  });
});
