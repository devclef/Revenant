import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BRAND_COPY } from "@/components/brand/copy";

import { REPO_ROOT, readSourceFiles } from "./source-scan";

/**
 * Tagline source (spec 09, F2.4, design.md "F. Framing"). The Tagline is
 * defined once, in Brand_Copy (`src/components/brand/copy.ts`). The landing
 * page and the site metadata import it from there and define no copy of their
 * own.
 */

const TAGLINE = "Memory rewrites itself. Revenant doesn't.";
const BRAND_COPY_FILE = "src/components/brand/copy.ts";

/** An import of BRAND_COPY from the brand copy module, by any path that ends in brand/copy. */
const BRAND_COPY_IMPORT =
  /import\s*\{[^}]*\bBRAND_COPY\b[^}]*\}\s*from\s*["'][^"']*brand\/copy["']/;

function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

describe("F2.4 tagline source", () => {
  it("BRAND_COPY holds the Tagline", () => {
    expect(BRAND_COPY.tagline).toBe(TAGLINE);
  });

  it("the Tagline appears in exactly one non-test source file, brand/copy.ts", () => {
    // Code only. ASSETS.md rows describe the Open Graph image and quote the
    // Tagline in a table; they are documentation, not a definition (design F).
    const files = readSourceFiles(["src"], [".ts", ".tsx"]);
    const owners = files
      .filter((file) => file.text.includes(TAGLINE))
      .map((file) => file.path);
    expect(owners).toEqual([BRAND_COPY_FILE]);
  });

  it("page-metadata imports the Tagline from Brand_Copy and defines none", () => {
    const text = readRepoFile("src/lib/page-metadata.ts");
    expect(text).toMatch(BRAND_COPY_IMPORT);
    expect(text).not.toContain(TAGLINE);
  });

  it("the landing page defines no Tagline and renders the hero that imports it from Brand_Copy", () => {
    const page = readRepoFile("src/app/page.tsx");
    expect(page).not.toContain(TAGLINE);
    expect(page).toMatch(/<LandingHero\b/);

    const hero = readRepoFile("src/components/landing/LandingHero.tsx");
    expect(hero).toMatch(BRAND_COPY_IMPORT);
  });
});
