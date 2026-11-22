import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "receipts.module.css"), "utf8");

// The declaration body of the `.receipts` rule (not `.receiptsX` or a grouped selector).
const rule = css.match(/(?:^|\n)\.receipts\s*\{([^}]*)\}/);

describe("receipts column width (persona column and live Reveal_Host share one width)", () => {
  it("has a .receipts rule", () => {
    expect(rule).not.toBeNull();
  });

  it("fills its container with inline-size: 100%", () => {
    expect(rule?.[1]).toMatch(/(?:^|;|\s)inline-size:\s*100%\s*;/);
  });

  it("caps its width at the shared content column", () => {
    expect(rule?.[1]).toMatch(/max-inline-size:\s*var\(--content-column-max\)\s*;/);
  });

  it("centres itself with margin-inline: auto", () => {
    expect(rule?.[1]).toMatch(/margin-inline:\s*auto\s*;/);
  });
});
