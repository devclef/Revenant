// Feature: 13-the-seal
// Wax pool stages (P2.2, P3.1, P3.2): the stage mapping and the CSS that draws it.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { poolStage } from "./press-pose";
import type { PoolStage } from "./press-pose";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "press.module.css"), "utf8");

describe("poolStage boundaries", () => {
  it("holds the bead below one third, then spreads, then the full pool at 1", () => {
    const cases: Array<[number, PoolStage]> = [
      [0, "bead"],
      [0.1, "bead"],
      [1 / 3 - 0.001, "bead"],
      [1 / 3, "spread"],
      [0.5, "spread"],
      [0.999, "spread"],
      [1, "full"],
    ];
    for (const [progress, stage] of cases) {
      expect(poolStage(progress)).toBe(stage);
    }
  });

  it("treats NaN and negative progress as the bead, never a later stage", () => {
    expect(poolStage(Number.NaN)).toBe("bead");
    expect(poolStage(-0.5)).toBe("bead");
  });
});

describe("press.module.css pool stages", () => {
  it.each(["bead", "spread", "full"] as const)(
    "draws the %s stage on the wax, by data-pool-stage",
    (stage) => {
      expect(css).toContain(`.press[data-pool-stage="${stage}"] .wax`);
    },
  );

  it("does not draw the wax with a per-frame size change beyond the progress transform", () => {
    // Stage rules swap shape only. The progress scale stays the one transform on .wax.
    const stageBlocks = css.match(
      /\.press\[data-pool-stage="[a-z]+"\] \.wax \{[^}]*\}/g,
    );
    expect(stageBlocks).not.toBeNull();
    for (const block of stageBlocks ?? []) {
      expect(block).not.toMatch(/transform/);
    }
  });
});

describe("press.module.css running prompt", () => {
  it("keeps the wax at full opacity with no halo while a prompt runs", () => {
    expect(css).toMatch(
      /\.press\[data-press-running\]\[aria-disabled="true"\] \.wax \{\s*opacity: 1;\s*box-shadow: none;\s*\}/,
    );
  });

  it("keeps the 40 % unready rule and the aria-disabled value it keys on", () => {
    expect(css).toMatch(
      /\.press\[aria-disabled="true"\] \.wax \{\s*opacity: 0\.4;\s*\}/,
    );
  });
});
