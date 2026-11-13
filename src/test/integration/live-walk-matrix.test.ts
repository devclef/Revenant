import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { WALK_STEP_NAMES } from "./live-walk-helpers";
import {
  WALK_MATRIX,
  matrixRun,
  matrixShotNames,
  walkEnabled,
} from "./live-walk-matrix";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const REPLAY = "src/test/integration/live-walk.test.ts";

describe("WALK_MATRIX", () => {
  it("has six runs: no figure, one figure and one reduced run at each width", () => {
    expect(WALK_MATRIX).toHaveLength(6);
  });

  it("covers both widths with the expected variants", () => {
    const at = (width: number) =>
      WALK_MATRIX.filter((e) => e.width === width).map((e) => ({
        variant: e.variant,
        reduced: e.reduced,
      }));
    expect(at(1440)).toEqual([
      { variant: "no-figure", reduced: false },
      { variant: "one-figure", reduced: false },
      { variant: "one-figure", reduced: true },
    ]);
    expect(at(390)).toEqual(at(1440));
    expect(WALK_MATRIX.map((e) => [e.width, e.height])).toEqual([
      [1440, 900],
      [1440, 900],
      [1440, 900],
      [390, 844],
      [390, 844],
      [390, 844],
    ]);
  });

  it("gives every run a unique id", () => {
    const ids = WALK_MATRIX.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists one Step_Shot per walk step for each run", () => {
    for (const entry of WALK_MATRIX) {
      const names = matrixShotNames(entry);
      expect(names).toHaveLength(WALK_STEP_NAMES.length);
      for (const name of names) {
        expect(name).toMatch(
          entry.reduced
            ? /^live-\d{2}-[a-z-]+-\d+x\d+-reduced\.png$/
            : /^live-\d{2}-[a-z-]+-\d+x\d+\.png$/,
        );
        expect(name).toContain(`-${entry.width}x${entry.height}`);
      }
    }
  });
});

describe("matrixRun", () => {
  it("picks a figure only for the one-figure variant", () => {
    const figures = WALK_MATRIX.map((e) => [e.variant, matrixRun(e).figure]);
    expect(figures).toEqual([
      ["no-figure", false],
      ["one-figure", true],
      ["one-figure", true],
      ["no-figure", false],
      ["one-figure", true],
      ["one-figure", true],
    ]);
  });

  it("takes width, height and motion from the entry", () => {
    for (const entry of WALK_MATRIX) {
      expect(matrixRun(entry)).toEqual({
        size: { width: entry.width, height: entry.height },
        reduced: entry.reduced,
        figure: entry.variant === "one-figure",
      });
    }
  });

  it("gives each width both a no-figure and a one-figure run", () => {
    for (const width of [1440, 390]) {
      const runs = WALK_MATRIX.filter((e) => e.width === width).map(
        (e) => matrixRun(e).figure,
      );
      expect(runs).toContain(false);
      expect(runs).toContain(true);
    }
  });
});

describe("matrixShotNames with a step filter", () => {
  it("keeps only the named steps, in walk order", () => {
    const entry = WALK_MATRIX.find((e) => e.id === "390x844-one-figure");
    expect(entry).toBeDefined();
    const names = matrixShotNames(entry!, ["write", "seal", "testify"]);
    expect(names).toEqual([
      "live-01-write-390x844.png",
      "live-03-seal-390x844.png",
      "live-06-testify-390x844.png",
    ]);
  });

  it("names the reduced run with the -reduced suffix", () => {
    const entry = WALK_MATRIX.find(
      (e) => e.id === "1440x900-one-figure-reduced",
    );
    expect(entry).toBeDefined();
    expect(matrixShotNames(entry!, ["write"])).toEqual([
      "live-01-write-1440x900-reduced.png",
    ]);
  });
});

describe("walkEnabled", () => {
  it("is false when WALK is unset, so the replay is skipped", () => {
    expect(walkEnabled({})).toBe(false);
  });

  it("is false for any value other than exactly 1", () => {
    expect(walkEnabled({ WALK: "" })).toBe(false);
    expect(walkEnabled({ WALK: "true" })).toBe(false);
    expect(walkEnabled({ WALK: "0" })).toBe(false);
  });

  it("is true only when WALK is 1", () => {
    expect(walkEnabled({ WALK: "1" })).toBe(true);
  });
});

describe("live-walk.test.ts with WALK unset", () => {
  it("is skipped, runs no browser step, and exits 0", () => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.WALK;
    delete env.WALK_VARIANT;
    const run = spawnSync(
      process.execPath,
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--project",
        "integration",
        REPLAY,
      ],
      { cwd: ROOT, env, encoding: "utf8", timeout: 240_000 },
    );
    const output = `${run.stdout}\n${run.stderr}`.replace(
      /\u001b\[[0-9;]*m/g,
      "",
    );
    expect(run.error).toBeUndefined();
    expect(run.status).toBe(0);
    expect(output).toMatch(/Tests\s+\d+ skipped \(\d+\)/);
    expect(output).not.toMatch(/\d+ passed/);
    expect(output).not.toMatch(/\bfailed\b/);
  });
});
