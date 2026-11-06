// Feature: 09-demo-polish, A14 (branded not-found and error pages)
//
// Import scan. BrandedPage and the two branded pages must not pull in the
// Soil_Canvas, the crypto library or the Opening_Flow code. Those modules are
// heavy and browser-only, and an error page must render even when they fail.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const FORBIDDEN = /soil-canvas|lib\/crypto|Opening_Flow|OpeningFlow|opening-flow/;

const files = {
  "BrandedPage.tsx": resolve(here, "BrandedPage.tsx"),
  "app/not-found.tsx": resolve(here, "../../app/not-found.tsx"),
  "app/error.tsx": resolve(here, "../../app/error.tsx"),
};

function importsOf(path: string): string[] {
  const source = readFileSync(path, "utf8");
  return [...source.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)].map((m) => m[1]);
}

describe("branded pages import scan", () => {
  for (const [name, path] of Object.entries(files)) {
    it(`${name} imports no Soil_Canvas, crypto or Opening_Flow module`, () => {
      for (const specifier of importsOf(path)) {
        expect(specifier, `${name} imports ${specifier}`).not.toMatch(FORBIDDEN);
      }
    });
  }
});
