import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { hasPrimaryCard, stepForStage } from "../stepper/live-steps";

const here = dirname(fileURLToPath(import.meta.url));
const stepCss = readFileSync(join(here, "seal-step.module.css"), "utf8");
const pressCss = readFileSync(
  join(here, "..", "press", "press.module.css"),
  "utf8",
);
const pressEnvelopeTsx = readFileSync(
  join(here, "..", "press", "PressEnvelope.tsx"),
  "utf8",
);
const sealStepTsx = readFileSync(join(here, "SealStep.tsx"), "utf8");

/** Declarations of the first rule whose selector is exactly `selector`. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|[\\s},])${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return m ? m[1] : "";
}

describe("hasPrimaryCard", () => {
  it("is true for the write step", () => {
    expect(hasPrimaryCard("write")).toBe(true);
  });

  it("is false for the seal step", () => {
    expect(hasPrimaryCard("seal")).toBe(false);
  });

  it("is true for the wait step", () => {
    expect(hasPrimaryCard("wait")).toBe(true);
  });

  it("is false for the testify, break and receipts steps", () => {
    expect(hasPrimaryCard("testify")).toBe(false);
    expect(hasPrimaryCard("break")).toBe(false);
    expect(hasPrimaryCard("receipts")).toBe(false);
  });
});

describe("stage thresholds", () => {
  it("still map the reveal stages to the break and receipts steps", () => {
    expect(stepForStage("marks")).toBe("break");
    expect(stepForStage("seal")).toBe("break");
    expect(stepForStage("letter")).toBe("receipts");
    expect(stepForStage("figures")).toBe("receipts");
    expect(stepForStage("close")).toBe("receipts");
    expect(stepForStage("emerging")).toBeNull();
  });
});

describe("Seal step panel fill (issue #586)", () => {
  it("sets the .step panel to the full inline size of its surface", () => {
    const body = ruleBody(stepCss, ".step");
    expect(body).toMatch(/inline-size:\s*100%;/);
    expect(body).not.toMatch(/margin-inline:\s*auto;/);
    expect(body).not.toMatch(/max-width:/);
  });

  it("keeps the text measure on the text column, not the panel", () => {
    expect(ruleBody(stepCss, ".text")).toMatch(/max-width:\s*520px;/);
    expect(ruleBody(stepCss, ".intro")).toMatch(/max-width:\s*520px;/);
  });

  it("marks the Seal step and its press column with data attributes", () => {
    expect(sealStepTsx).toMatch(/data-seal-step=""/);
    expect(pressEnvelopeTsx).toMatch(/data-press-target=""/);
    expect(pressEnvelopeTsx).toMatch(/data-wax=""/);
  });
});

describe("wax floor (issue #586)", () => {
  /*
   * Evaluates the width expression that press.module.css sets on .wax, so the
   * test reads the real CSS rather than a copy of its formula. `100cqi` is the
   * press column width and `var(--press-progress)` is the progress.
   */
  const waxExpression = (): string => {
    const body = ruleBody(pressCss, ".wax");
    const m = /width:\s*calc\(([\s\S]*?)\);\s*\n/.exec(body);
    if (!m) throw new Error("the .wax width calc is missing");
    return m[1].replace(/\s+/g, " ").trim();
  };

  /** Rendered wax width in px for a press column of `containerPx` at `progress`. */
  const waxWidth = (containerPx: number, progress: number): number => {
    const expr = waxExpression()
      .replace(/100cqi/g, "W")
      .replace(/var\(--press-progress\)/g, "P")
      .replace(/(\d+(?:\.\d+)?)px/g, "$1");
    return new Function("min", "W", "P", `return ${expr};`)(
      Math.min,
      containerPx,
      progress,
    ) as number;
  };

  it("rests the wax at 44 px at 360, 390 and 1440 px and grows it to full size at progress 1", () => {
    expect(pressCss).not.toMatch(/scale\(calc\(0\.25/);
    for (const px of [360, 390, 1440]) {
      expect(waxWidth(px, 0)).toBeGreaterThanOrEqual(44);
      expect(waxWidth(px, 0)).toBeCloseTo(44);
      expect(waxWidth(px, 1)).toBeCloseTo(Math.min(440, px) * (112 / 440));
    }
    expect(waxWidth(440, 1)).toBeCloseTo(112);
    expect(waxWidth(440, 0.5)).toBeCloseTo(78);
  });

  it("keeps the press-and-hold pool stages unchanged", () => {
    expect(ruleBody(pressCss, '.press[data-pool-stage="bead"] .wax')).toMatch(
      /aspect-ratio:\s*2 \/ 1;/,
    );
    expect(ruleBody(pressCss, '.press[data-pool-stage="full"] .wax')).toMatch(
      /aspect-ratio:\s*1;/,
    );
  });

  it("keeps the ready halo unchanged", () => {
    expect(ruleBody(pressCss, ".press[data-ready] .wax")).toMatch(
      /box-shadow:\s*0 0 0 10px rgba\(255, 123, 28, 0\.18\),/,
    );
  });

  it("keeps the passkey prompt wax whole at full opacity", () => {
    const body = ruleBody(
      pressCss,
      '.press[data-press-running][aria-disabled="true"] .wax',
    );
    expect(body).toMatch(/opacity:\s*1;/);
    expect(body).toMatch(/box-shadow:\s*none;/);
  });
});
