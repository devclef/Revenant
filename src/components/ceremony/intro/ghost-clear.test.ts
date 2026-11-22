// Feature: 17-screen-layout-fixes (spec 17 task 7, fix D4)
//
// Source guard for the phone Ghost clearance. The Persona_Intro must start
// below the Ghost's drawn bottom, so the Ghost's placement must stay as it is
// and the intro margin must read the published --ghost-bottom. This test reads
// the source files, so it fails the moment any of them drifts.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sceneCss = readFileSync(
  join(here, "..", "scene", "scene.module.css"),
  "utf8",
);
const introCss = readFileSync(join(here, "intro.module.css"), "utf8");
const ghostTsx = readFileSync(join(here, "..", "scene", "Ghost.tsx"), "utf8");
const constantsTs = readFileSync(join(here, "..", "constants.ts"), "utf8");

describe("ghost clear of the intro (spec 17 D4)", () => {
  it("defines --ghost-bottom on .scene in the phone media query", () => {
    const declaration =
      "--ghost-bottom: calc(var(--soil-top) + 3vh - 0.086 * min(26vh, 170px));";
    const index = sceneCss.indexOf(declaration);
    expect(index).toBeGreaterThan(-1);
    // The declaration must sit directly inside a `.scene {` block, so the
    // Persona_Intro (a sibling of the ghost layer) inherits it.
    const before = sceneCss.slice(0, index);
    const open = before.lastIndexOf("{");
    expect(before.slice(0, open).trimEnd()).toMatch(/\.scene$/);
  });

  it("gives the Persona_Intro a margin-block-start from --ghost-bottom", () => {
    expect(introCss).toContain("--intro-top: 2.5rem;");
    expect(introCss).toContain(
      "margin-block-start: max(0px, calc(var(--ghost-bottom) - var(--intro-top)));",
    );
  });

  it("marks the Ghost's drawn box with data-ghost-box", () => {
    expect(ghostTsx).toContain("data-ghost-box");
  });

  it("keeps the Ghost placement constants unchanged", () => {
    expect(constantsTs).toContain(
      'export const GHOST_WIDE = "min(50vh, 560px)";',
    );
    expect(constantsTs).toContain(
      'export const GHOST_NARROW = "min(26vh, 170px)";',
    );
    expect(constantsTs).toContain("export const GHOST_HEIGHT_RATIO = 1.2;");
    expect(constantsTs).toContain("export const GHOST_X_IN_FRAME = 0.72;");
    expect(constantsTs).toContain("export const GHOST_X_NARROW = 0.5;");
    expect(constantsTs).toContain("export const GHOST_RISEN_WIDE = -0.07;");
    expect(constantsTs).toContain("export const GHOST_RISEN_NARROW = -0.03;");
  });
});
