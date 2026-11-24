import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Frozen paths from spec 18-persona-dates, Requirement 15 and the Rules in tasks.md.
// No task in that spec changes these paths. A path ending in "/" is a directory.
const FROZEN_PATHS = [
  ".kiro/",
  ".github/",
  "tools/agents/",
  "tools/dispatcher/",
  "tools/hooks/",
  "src/lib/crypto/",
  "src/lib/seal-format/",
  "src/app/api/",
  "src/lib/letter-store/",
  "src/lib/db/",
  "drizzle/",
  "deploy/helm/revenant/",
  "scripts/check.sh",
  "scripts/check-js-budget.mjs",
  "package.json",
  "package-lock.json",
  ".env.example",
  "docs/kiro-writeup.md",
  "src/lib/figures/then-now.ts",
  "src/lib/figures/at-opening.ts",
] as const;

// Chart version recorded when the frozen list was written (Requirement 15.1).
const RECORDED_CHART_VERSION = "0.6.0";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("frozen paths (spec 18, Requirement 15)", () => {
  it.each(FROZEN_PATHS)("%s exists in the worktree", (path) => {
    expect(existsSync(new URL(path, `file://${ROOT}`))).toBe(true);
  });

  it("records the Helm chart version that matches Chart.yaml", () => {
    const chart = readFileSync(
      new URL("deploy/helm/revenant/Chart.yaml", `file://${ROOT}`),
      "utf8",
    );
    const match = /^version:\s*(\S+)\s*$/m.exec(chart);
    expect(match?.[1]).toBe(RECORDED_CHART_VERSION);
  });
});
