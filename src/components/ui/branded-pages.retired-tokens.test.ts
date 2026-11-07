// Feature: 09-demo-polish, L3.1 and L3.2 (Retired_Tokens and ParchmentSurface)
//
// Scans every file this step and the earlier spec 09 steps change, and fails if
// one defines or uses a Retired_Token or imports ParchmentSurface. The list is
// the set of files the branch changes; a later step adds its own files here.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");

/** Files changed by spec 09 tasks 1 to 3, relative to the repository root. */
const CHANGED_FILES = [
  "src/app/demo/page.module.css",
  "src/app/demo/page.tsx",
  "src/app/demo/personas/[key]/not-found.tsx",
  "src/app/demo/personas/[key]/not-found.test.tsx",
  "src/app/l/[id]/not-found.tsx",
  "src/app/l/[id]/not-found.test.tsx",
  "src/components/ceremony/ASSETS.md",
  "src/components/ceremony/copy-exact.property.test.ts",
  "src/components/ceremony/envelope/Envelope.module.css",
  "src/components/ceremony/envelope/Envelope.tsx",
  "src/components/ceremony/r11-accessibility.test.ts",
  "src/components/ceremony/recall/RecallPager.property.test.tsx",
  "src/components/ceremony/seal/SealBreak.tsx",
  "src/components/ceremony/seal/cracks.ts",
  "src/components/demo/DemoLabel.module.css",
  "src/components/demo/LiveEntry.module.css",
  "src/components/demo/PersonaCard.module.css",
  "src/components/demo/PersonaCard.test.tsx",
  "src/components/demo/PersonaCard.tsx",
  "src/components/demo/copy.ts",
  "src/components/live/copy.ts",
  "src/components/reveal/Reveal.marks.test.tsx",
  "src/components/reveal/SealedLetter.live.test.tsx",
  "src/components/reveal/SealedLetter.tsx",
  "src/components/ui/WaxSeal.module.css",
  "src/components/ui/WaxSeal.test.tsx",
  "src/components/ui/WaxSeal.tsx",
];

/** `--desk-*`, `--gold-leaf`, `--gold-text`, `--seal`, `--ink-faded`, `ParchmentSurface`. */
const RETIRED = /--desk-|--gold-leaf|--gold-text|--seal(?![A-Za-z0-9_-])|--ink-faded|ParchmentSurface/;

describe("Retired_Tokens are gone from the files spec 09 changes", () => {
  for (const file of CHANGED_FILES) {
    it(`${file} has no Retired_Token and no ParchmentSurface`, () => {
      const source = readFileSync(resolve(root, file), "utf8");
      const match = source.match(RETIRED);
      expect(match?.[0] ?? null, `${file} contains ${match?.[0]}`).toBeNull();
    });
  }
});
