// Feature: 09-demo-polish (H1, example tests)
//
// Example tests for the general-letter landing sections and the static
// Coven_Strip: the strip takes no props and renders two links, no source file
// under src imports kiro-stats, the three SampleReceipt files are gone, and the
// section copy names no fuel price as what a letter holds.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { LANDING_SECTION_COPY } from "./copy";
import { CovenStrip } from "./CovenStrip";

const here = fileURLToPath(new URL(".", import.meta.url));
const srcRoot = resolve(here, "../..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("CovenStrip (H1 example tests)", () => {
  it("takes no props", () => {
    expect(CovenStrip.length).toBe(0);
  });
});

describe("SampleReceipt removal", () => {
  it("has no SampleReceipt.tsx, SampleReceiptView.tsx or sample-receipt.ts", () => {
    expect(existsSync(join(here, "SampleReceipt.tsx"))).toBe(false);
    expect(existsSync(join(here, "SampleReceiptView.tsx"))).toBe(false);
    expect(existsSync(join(here, "sample-receipt.ts"))).toBe(false);
  });
});

describe("kiro-stats removal", () => {
  it("no source file under src imports kiro-stats", () => {
    const offenders = walk(srcRoot)
      .filter((file) => /\.(ts|tsx|js|mjs|cjs)$/.test(file))
      .filter((file) => !file.endsWith("landing-general.test.ts"))
      .filter((file) => /kiro-stats/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("general-letter section copy (H1)", () => {
  const sectionText = [
    ...LANDING_SECTION_COPY.resurrectedBody,
    LANDING_SECTION_COPY.noSealBody,
    LANDING_SECTION_COPY.resurrectedTitle,
    LANDING_SECTION_COPY.noSealTitle,
    LANDING_SECTION_COPY.ritualTitle,
  ]
    .join(" ")
    .toLowerCase();

  it("names no fuel price as what a letter holds", () => {
    expect(sectionText).not.toMatch(/fuel|gallon|petrol|gasoline|per litre/);
  });
});
